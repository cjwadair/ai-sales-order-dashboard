module Reports
  # Turns a *validated* IR spec into a parameterized ActiveRecord relation plus
  # output-column metadata. Safe by construction:
  #
  #   * identifiers (tables/columns) come ONLY from the semantic config (trusted);
  #   * joins come ONLY from the curated relationship graph (never model-authored);
  #   * filter values are bound via Arel (quoted/escaped, never interpolated);
  #   * aliases were charset-validated upstream before being embedded.
  #
  # Projection and grouping use full Arel nodes (NamedFunction / Attribute) so
  # the same node instance drives both SELECT and GROUP BY — no string duplication.
  # Dialect-specific SQL (date_trunc) lives in Reports::SqlAdapter.
  #
  # Assumes the IR already passed IrValidator. Returns a CompiledQuery.
  class Compiler
    CompiledQuery = Struct.new(:relation, :columns, :applied_limit, :limit_defaulted, keyword_init: true)

    class CompileError < StandardError; end

    def initialize(config)
      @config = config
      @connection = ActiveRecord::Base.connection
      @sql_adapter = SqlAdapter.for(@connection.adapter_name)
    end

    def compile(ir)
      @ir = ir
      dims     = Array(ir["dimensions"])
      measures = Array(ir["measures"])

      relation = base_relation
      relation = apply_joins_and_filters(relation, dims, measures, ir["filters"])

      dim_nodes       = dims.map { |d| dimension_node(d) }
      dim_selects     = dim_nodes.zip(dims).map { |node, d| node.as(quote_alias(Aliasing.dimension_alias(d))) }
      measure_selects = measures.map { |m| measure_node(m).as(quote_alias(Aliasing.measure_alias(m))) }

      relation = relation.select(*dim_selects, *measure_selects)
      relation = relation.group(*dim_nodes) if dim_nodes.any?
      relation = apply_sort(relation, Array(ir["sort"]))

      explicit_limit = ir["limit"]
      if explicit_limit.present?
        relation = relation.limit(explicit_limit)
        CompiledQuery.new(relation: relation, columns: columns_for(dims, measures),
                          applied_limit: explicit_limit, limit_defaulted: false)
      else
        relation = relation.limit(IrValidator::MAX_LIMIT)
        CompiledQuery.new(relation: relation, columns: columns_for(dims, measures),
                          applied_limit: IrValidator::MAX_LIMIT, limit_defaulted: true)
      end
    end

    private

    def base_relation
      root_model.all
    end

    # Applies joins and WHERE conditions together so EXISTS entities can skip a JOIN.
    # has_many entities referenced only in filters get a correlated EXISTS subquery
    # instead of a JOIN — this avoids row-multiplication on root-side aggregates.
    def apply_joins_and_filters(relation, dims, measures, filters)
      exists_candidates = filter_only_has_many_entities(dims, measures, filters)

      if exists_candidates.any? && filters.present?
        regular_node, exists_map = split_filter_tree(filters, exists_candidates.to_set)
        relation = apply_joins(relation, dims, measures, filters, skip: exists_map.keys.to_set)
        relation = relation.where(build_filter(regular_node)) if regular_node.present?
        exists_map.each { |entity_name, conds| relation = relation.where(build_exists(entity_name, conds)) }
      else
        relation = apply_joins(relation, dims, measures, filters)
        relation = relation.where(build_filter(filters)) if filters.present?
      end

      relation
    end

    # has_many entities whose fields appear only in filters, not dims/measures.
    def filter_only_has_many_entities(dims, measures, filters)
      return [] if filters.blank?

      dim_measure_entities = (
        dims.filter_map { |d| @config.resolve(d["field"])&.dig(:entity) } +
        measures.filter_map { |m| m["field"].present? ? @config.resolve(m["field"])&.dig(:entity) : nil }
      ).reject { |e| @config.root?(e) }.to_set

      filter_field_refs(filters)
        .filter_map { |ref| @config.resolve(ref)&.dig(:entity) }
        .reject { |e| @config.root?(e) }
        .uniq
        .select { |e| !dim_measure_entities.include?(e) && @config.relationship(e)&.dig(:kind) == :has_many }
    end

    # Recursively splits a filter tree into (kept_for_WHERE, entity=>[conditions]).
    # AND groups: item conditions are extracted. OR groups: if any child is extracted
    # the whole OR is left intact (can't partially satisfy an OR with EXISTS).
    def split_filter_tree(node, exists_entity_names)
      return [node, {}] unless node.is_a?(Hash)

      if node.key?("conditions")
        op = node["op"].to_s
        kept_children = []
        all_extracted = {}

        Array(node["conditions"]).each do |child|
          kept, extracted = split_filter_tree(child, exists_entity_names)
          if op == "or" && extracted.any?
            return [node, {}]
          end
          kept_children << kept unless kept.nil?
          extracted.each { |k, v| (all_extracted[k] ||= []).concat(v) }
        end

        kept_node = case kept_children.size
                    when 0 then nil
                    when 1 then kept_children.first
                    else node.merge("conditions" => kept_children)
                    end
        [kept_node, all_extracted]
      elsif node.key?("field")
        field = @config.resolve(node["field"])
        entity_name = field&.dig(:entity)
        if exists_entity_names.include?(entity_name)
          [nil, { entity_name => [node] }]
        else
          [node, {}]
        end
      else
        [node, {}]
      end
    end

    # Correlated EXISTS subquery for a filter-only has_many entity.
    # SELECT 1 FROM <target_table> WHERE <fk> = <root_pk> AND <conditions>
    def build_exists(entity_name, conditions)
      rel = @config.relationship(entity_name)
      target_table = Arel::Table.new(rel[:table])
      root_table = Arel::Table.new(@config.root_entity[:table])

      fk_pred = target_table[rel[:foreign_key]].eq(root_table[@config.root_entity[:primary_key]])
      item_preds = conditions.map { |c| condition_predicate(c) }
      all_preds = ([fk_pred] + item_preds).inject(:and)

      subquery = target_table.project(Arel.sql("1")).where(all_preds)
      Arel::Nodes::Exists.new(subquery)
    end

    def root_model
      @root_model ||= @config.root_entity[:table].classify.constantize
    end

    # --- joins ------------------------------------------------------------

    def apply_joins(relation, dims, measures, filters, skip: [])
      skip_set = skip.to_set
      entities = referenced_entities(dims, measures, filters).reject { |e| skip_set.include?(e) }
      associations = entities.map do |entity_name|
        rel = @config.relationship(entity_name)
        raise CompileError, "no relationship to #{entity_name.inspect}" unless rel
        rel[:association]
      end
      associations.uniq.inject(relation) { |r, assoc| r.joins(assoc) }
    end

    def referenced_entities(dims, measures, filters)
      refs = dims.map { |d| d["field"] }
      refs += measures.map { |m| m["field"] }.compact
      refs += filter_field_refs(filters)
      refs.compact.filter_map { |ref| @config.resolve(ref)&.dig(:entity) }
          .reject { |entity| @config.root?(entity) }
          .uniq
    end

    def filter_field_refs(node, acc = [])
      return acc unless node.is_a?(Hash)
      if node.key?("conditions")
        Array(node["conditions"]).each { |c| filter_field_refs(c, acc) }
      elsif node["field"]
        acc << node["field"]
      end
      acc
    end

    # --- WHERE (Arel, values bound) --------------------------------------

    def build_filter(node)
      if node.key?("conditions")
        children = Array(node["conditions"]).map { |c| build_filter(c) }
        combined =
          if node["op"].to_s == "or"
            children.inject { |acc, n| acc.or(n) }
          else
            children.inject(:and)
          end
        Arel::Nodes::Grouping.new(combined)
      else
        condition_predicate(node)
      end
    end

    def condition_predicate(cond)
      field = @config.resolve(cond["field"])
      attr  = Arel::Table.new(field[:table])[field[:column]]
      op    = cond["op"].to_s

      # Reference fields flagged `case_sensitive: false` compare both sides lower-cased, so
      # an NL-cased term ("warehouse 2", "wh2") matches the stored value ("Warehouse 2", "WH2").
      # `like` already renders ILIKE on Postgres, so only equality ops need folding.
      ci = field[:case_sensitive] == false

      case op
      when "eq"      then ci ? lower(attr).eq(ci_value(cond["value"]))     : attr.eq(value_for(cond["value"]))
      when "neq"     then ci ? lower(attr).not_eq(ci_value(cond["value"])) : attr.not_eq(value_for(cond["value"]))
      when "gt"      then attr.gt(value_for(cond["value"]))
      when "gte"     then attr.gteq(value_for(cond["value"]))
      when "lt"      then attr.lt(value_for(cond["value"]))
      when "lte"     then attr.lteq(value_for(cond["value"]))
      when "between" then attr.between(Range.new(*cond["value"].map { |v| value_for(v) }))
      when "in"      then ci ? lower(attr).in(cond["value"].map { |v| ci_value(v) }) : attr.in(cond["value"].map { |v| value_for(v) })
      when "like"    then attr.matches("%#{value_for(cond["value"])}%")
      when "is_null" then attr.eq(nil)
      else
        raise CompileError, "unsupported operator #{op.inspect}"
      end
    end

    # LOWER(col) Arel node, for case-insensitive comparisons.
    def lower(attr)
      Arel::Nodes::NamedFunction.new("LOWER", [attr])
    end

    # The bound, lower-cased comparison value (still parameterized by Arel, never interpolated).
    def ci_value(raw)
      value_for(raw).to_s.downcase
    end

    def value_for(raw)
      return RelativeDate.resolve(raw["relative"]) if raw.is_a?(Hash) && raw.key?("relative")
      raw
    end

    # --- SELECT / GROUP nodes (full Arel) ---------------------------------

    # Returns an Arel attribute or NamedFunction node for this dimension.
    # The same node instance is reused for both the aliased SELECT and GROUP BY.
    def dimension_node(dim)
      field = @config.resolve(dim["field"])
      attr = Arel::Table.new(field[:table])[field[:column]]
      dim["grain"].present? ? @sql_adapter.date_trunc(dim["grain"], attr) : attr
    end

    # Returns an Arel aggregate node (NamedFunction or Count) for this measure.
    def measure_node(measure)
      fn = measure["fn"].to_s
      return Arel::Nodes::NamedFunction.new("COUNT", [Arel.sql("*")]) if fn == "count"

      field = @config.resolve(measure["field"])
      attr  = Arel::Table.new(field[:table])[field[:column]]

      case fn
      when "count_distinct" then Arel::Nodes::Count.new([attr], true)
      when "sum"            then Arel::Nodes::NamedFunction.new("SUM", [attr])
      when "avg"            then Arel::Nodes::NamedFunction.new("AVG", [attr])
      when "min"            then Arel::Nodes::NamedFunction.new("MIN", [attr])
      when "max"            then Arel::Nodes::NamedFunction.new("MAX", [attr])
      else raise CompileError, "unsupported function #{fn.inspect}"
      end
    end

    def quote_alias(name)
      @connection.quote_column_name(name)
    end

    # --- ORDER BY (by validated alias) -----------------------------------

    def apply_sort(relation, sort)
      sort.inject(relation) do |r, s|
        direction = s["direction"].to_s.casecmp("desc").zero? ? "DESC" : "ASC"
        r.order(Arel.sql("#{quote_alias(s["ref"])} #{direction}"))
      end
    end

    # --- output column metadata ------------------------------------------

    def columns_for(dims, measures)
      cols = dims.map do |d|
        field = @config.resolve(d["field"])
        { name: Aliasing.dimension_alias(d), type: d["grain"].present? ? :date : field[:type] }
      end
      cols += measures.map { |m| { name: Aliasing.measure_alias(m), type: measure_type(m) } }
      cols
    end

    def measure_type(measure)
      case measure["fn"].to_s
      when "count", "count_distinct" then :integer
      when "avg"                     then :decimal
      else @config.resolve(measure["field"])[:type] # sum/min/max keep the field type
      end
    end
  end
end
