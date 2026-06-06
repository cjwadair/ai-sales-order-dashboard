module Reports
  # Semantic validation of an IR spec against the semantic config -- the
  # allowlist-by-construction gate. Every reference is checked: entity/field
  # exists & is exposed; the field has the role the slot requires; aggregations,
  # grains, enum values, and operators are legal for the field's type; sort refs
  # point at a declared alias; limit is within bounds.
  #
  # Returns an array of precise error messages ([] == valid). It never builds
  # SQL and never touches the database -- a clean failure here is a 422.
  class IrValidator
    MAX_LIMIT = 1000

    AGGREGATE_FNS = %w[count sum avg min max count_distinct].freeze
    GROUP_OPS     = %w[and or].freeze
    DIRECTIONS    = %w[asc desc].freeze

    ALL_OPS = %w[eq neq gt gte lt lte between in like is_null].freeze

    # Which operators are legal per field type.
    TYPE_OPS = {
      string:  %w[eq neq in like is_null],
      enum:    %w[eq neq in is_null],
      date:    %w[eq neq gt gte lt lte between in is_null],
      decimal: %w[eq neq gt gte lt lte between in is_null],
      integer: %w[eq neq gt gte lt lte between in is_null],
    }.freeze

    def initialize(config)
      @config = config
    end

    def validate(ir)
      @errors = []
      ir = ir || {}

      validate_source(ir["source"])
      dims     = Array(ir["dimensions"])
      measures = Array(ir["measures"])

      if dims.empty? && measures.empty?
        add("query must declare at least one dimension or measure")
      end

      dims.each { |d| validate_dimension(d) }
      measures.each { |m| validate_measure(m) }
      validate_filters(ir["filters"]) if ir["filters"].present?
      validate_sort(ir["sort"], declared_aliases(dims, measures)) if ir["sort"].present?
      validate_limit(ir["limit"]) if ir.key?("limit")

      @errors
    end

    private

    def add(message)
      @errors << message
    end

    def validate_source(source)
      return add("missing `source`") if source.blank?

      unless source.to_s == @config.root_entity_name
        add("unknown source #{source.inspect}")
      end
    end

    def validate_dimension(dim)
      ref = dim["field"]
      return add("dimension is missing `field`") if ref.blank?

      field = @config.resolve(ref)
      return add("unknown field #{ref.inspect}") unless field
      add("field #{ref.inspect} cannot be used as a dimension") unless field[:roles].include?(:dimension)

      if dim["grain"].present?
        if field[:type] != :date
          add("grain is only valid on date fields, not #{ref.inspect} (#{field[:type]})")
        elsif !Array(field[:grains]).include?(dim["grain"].to_sym)
          add("grain #{dim["grain"].inspect} is not allowed on #{ref.inspect}")
        end
      end

      validate_alias(dim["as"])
    end

    def validate_measure(measure)
      fn = measure["fn"]
      return add("measure is missing `fn`") if fn.blank?
      return add("unknown aggregation #{fn.inspect}") unless AGGREGATE_FNS.include?(fn.to_s)

      validate_alias(measure["as"])

      ref = measure["field"]

      if fn.to_s == "count"
        return # count(*) needs no field
      end

      return add("aggregation #{fn.inspect} requires a `field`") if ref.blank?

      field = @config.resolve(ref)
      return add("unknown field #{ref.inspect}") unless field

      if fn.to_s == "count_distinct"
        return # count_distinct is valid on any exposed field
      end

      unless field[:roles].include?(:measure)
        return add("cannot #{fn} #{ref.inspect}: not a measure")
      end

      unless Array(field[:aggregations]).include?(fn.to_sym)
        add("aggregation #{fn.inspect} is not allowed on #{ref.inspect}")
      end
    end

    def validate_filters(node, depth = 0)
      return add("filter nesting too deep") if depth > 10
      return add("filter node must be an object") unless node.is_a?(Hash)

      if node.key?("op") && GROUP_OPS.include?(node["op"].to_s) && node.key?("conditions")
        unless node["conditions"].is_a?(Array)
          return add("filter group `conditions` must be an array")
        end
        node["conditions"].each { |c| validate_filters(c, depth + 1) }
      elsif node.key?("field")
        validate_condition(node)
      else
        add("invalid filter node: #{node.inspect}")
      end
    end

    def validate_condition(cond)
      ref = cond["field"]
      op  = cond["op"]
      field = @config.resolve(ref)

      return add("unknown field #{ref.inspect}") unless field
      add("field #{ref.inspect} cannot be used as a filter") unless field[:roles].include?(:filter)
      return add("condition #{ref.inspect} is missing `op`") if op.blank?
      return add("unknown operator #{op.inspect}") unless ALL_OPS.include?(op.to_s)

      legal = TYPE_OPS.fetch(field[:type], [])
      unless legal.include?(op.to_s)
        return add("operator #{op.inspect} is not valid on #{ref.inspect} (#{field[:type]})")
      end

      validate_value(field, op.to_s, cond)
    end

    def validate_value(field, op, cond)
      return if op == "is_null" # no value needed

      unless cond.key?("value")
        return add("operator #{op.inspect} on #{field[:ref].inspect} requires a `value`")
      end
      value = cond["value"]

      case op
      when "in"
        return add("operator `in` on #{field[:ref].inspect} requires a non-empty array") unless value.is_a?(Array) && value.any?
        value.each { |v| validate_scalar(field, v) }
      when "between"
        return add("operator `between` on #{field[:ref].inspect} requires an array of two values") unless value.is_a?(Array) && value.size == 2
        value.each { |v| validate_scalar(field, v) }
      else
        return add("operator #{op.inspect} on #{field[:ref].inspect} expects a single value, not an array") if value.is_a?(Array)
        validate_scalar(field, value)
      end
    end

    # Validate a single value (literal or {relative}) against the field's type.
    def validate_scalar(field, value)
      if value.is_a?(Hash)
        token = value["relative"]
        return add("invalid value #{value.inspect} on #{field[:ref].inspect}") if token.blank?
        add("relative-date tokens are only valid on date fields, not #{field[:ref].inspect}") unless field[:type] == :date
        add("unknown relative-date token #{token.inspect}") unless RelativeDate.valid?(token)
        return
      end

      if field[:type] == :enum && Array(field[:values]).exclude?(value)
        add("#{value.inspect} is not an allowed value for #{field[:ref].inspect}")
      end
    end

    def validate_sort(sort, aliases)
      return add("`sort` must be an array") unless sort.is_a?(Array)

      sort.each do |s|
        ref = s["ref"]
        dir = s["direction"]
        add("sort entry is missing `ref`") if ref.blank?
        add("sort `direction` must be one of #{DIRECTIONS.join("/")}") unless DIRECTIONS.include?(dir.to_s)
        if ref.present? && aliases.exclude?(ref)
          add("sort ref #{ref.inspect} does not match any declared dimension or measure alias")
        end
      end
    end

    def validate_limit(limit)
      unless limit.is_a?(Integer) && limit >= 1 && limit <= MAX_LIMIT
        add("`limit` must be an integer between 1 and #{MAX_LIMIT}")
      end
    end

    def validate_alias(name)
      return if name.blank?
      add("alias #{name.inspect} contains illegal characters") unless Aliasing.valid_alias?(name)
    end

    def declared_aliases(dims, measures)
      dims.map { |d| Aliasing.dimension_alias(d) } +
        measures.map { |m| Aliasing.measure_alias(m) }
    end
  end
end
