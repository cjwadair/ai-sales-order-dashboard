module Reports
  # Projects the semantic config into the forced `query_report` tool: the
  # JSON-Schema `input_schema` whose enums ARE the grammar (the model cannot
  # emit anything it does not define), plus a field glossary for the (cached)
  # tool description (enums lose per-value docs, so they are paired with prose).
  #
  # Field-name enums are generated per role from the config, so unexposed
  # columns are structurally impossible to reference. Closed vocabularies
  # (operators, fns, grains, directions, relative-date tokens, limit max) are
  # pulled from IrValidator / RelativeDate so the schema and the validator can
  # never drift apart. The config is the cache key: regenerate only when it
  # changes.
  class ToolSchemaBuilder
    TOOL_NAME = "query_report".freeze

    DESCRIPTION_PREAMBLE = <<~TXT.strip
      Translate the user's question into a structured report query using ONLY the entities, fields, and operators provided. Prefer aggregations when the user asks for totals or "by"-groupings. For purely-relative time phrases use the provided relative-date tokens; for a specific or named period compute an absolute `between [start, end]` range (ISO YYYY-MM-DD, last day inclusive) from the current-date context. If the request needs something not expressible here (running totals, rankings, period-over-period), still return your best query and set `unsupported_note`. Note: when line-item fields are used as dimensions or filters, `count` counts line items, not orders.
    TXT

    # Canonical grain ordering for the generated enum.
    GRAIN_ORDER = %i[day week month quarter year].freeze

    def initialize(config)
      @config = config
    end

    # Full Anthropic tool definition: { name:, description:, input_schema: }.
    def build
      {
        name: TOOL_NAME,
        description: "#{DESCRIPTION_PREAMBLE}\n\n#{glossary_text}",
        input_schema: input_schema,
      }
    end

    def input_schema
      {
        "type" => "object",
        "required" => ["source"],
        "additionalProperties" => false,
        "properties" => {
          "source" => { "type" => "string", "enum" => [@config.root_entity_name] },
          "title"  => { "type" => "string" },
          "dimensions" => { "type" => "array", "items" => dimension_item },
          "measures"   => { "type" => "array", "items" => measure_item },
          "filters" => { "$ref" => "#/$defs/group" },
          "sort" => { "type" => "array", "items" => sort_item },
          "limit" => { "type" => "integer", "minimum" => 1, "maximum" => IrValidator::MAX_LIMIT },
          "unsupported_note" => { "type" => "string" },
        },
        "$defs" => {
          "group" => group_def,
          "condition" => condition_def,
        },
      }
    end

    # Human-readable field reference for the tool description.
    def glossary_text
      lines = ["Available data (use field references exactly as written):"]
      @config.glossary.each do |entity|
        header = entity[:root] ? "#{entity[:entity]} (root)" : entity[:entity]
        lines << ""
        lines << "#{header} — #{entity[:description]}"
        entity[:fields].each { |f| lines << "  - #{field_line(f)}" }
      end
      lines.join("\n")
    end

    private

    def field_line(field)
      head = "#{field[:ref]} (#{field[:type]}, #{Array(field[:roles]).join("/")})"
      head += " — #{field[:description]}" if field[:description].present?
      parts = [head]
      parts << "values: #{field[:values].join(", ")}" if field[:values].present?
      parts << "aggregations: #{field[:aggregations].join(", ")}" if field[:aggregations].present?
      parts << "grains: #{field[:grains].join(", ")}" if field[:grains].present?
      parts.join("; ")
    end

    def dimension_item
      {
        "type" => "object",
        "required" => ["field"],
        "additionalProperties" => false,
        "properties" => {
          "field" => { "type" => "string", "enum" => @config.enum_fields(:dimension) },
          "grain" => { "type" => "string", "enum" => grain_enum }, # dates only
          "as" => { "type" => "string" },
        },
      }
    end

    def measure_item
      {
        "type" => "object",
        "required" => ["fn"],
        "additionalProperties" => false,
        "properties" => {
          "fn" => { "type" => "string", "enum" => IrValidator::AGGREGATE_FNS },
          "field" => { "type" => "string", "enum" => @config.enum_fields(:measure) }, # omit when fn=count
          "as" => { "type" => "string" },
        },
      }
    end

    def sort_item
      {
        "type" => "object",
        "required" => %w[ref direction],
        "additionalProperties" => false,
        "properties" => {
          "ref" => { "type" => "string" }, # alias of a declared dimension/measure
          "direction" => { "type" => "string", "enum" => IrValidator::DIRECTIONS },
        },
      }
    end

    def group_def
      {
        "type" => "object",
        "required" => %w[op conditions],
        "additionalProperties" => false,
        "properties" => {
          "op" => { "type" => "string", "enum" => IrValidator::GROUP_OPS },
          "conditions" => {
            "type" => "array",
            "items" => { "oneOf" => [{ "$ref" => "#/$defs/group" }, { "$ref" => "#/$defs/condition" }] },
          },
        },
      }
    end

    def condition_def
      {
        "type" => "object",
        "required" => %w[field op],
        "additionalProperties" => false,
        "properties" => {
          "field" => { "type" => "string", "enum" => @config.enum_fields(:filter) },
          "op" => { "type" => "string", "enum" => IrValidator::ALL_OPS },
          "value" => {
            "oneOf" => [
              { "type" => %w[string number boolean] },
              { "type" => "array" },
              {
                "type" => "object",
                "required" => ["relative"],
                "additionalProperties" => false,
                "properties" => { "relative" => { "type" => "string", "enum" => RelativeDate::TOKENS } },
              },
            ],
          },
        },
      }
    end

    # Union of all date grains exposed in the config, in canonical order.
    def grain_enum
      exposed = @config.glossary.flat_map { |e| e[:fields] }
                       .flat_map { |f| Array(f[:grains]) }.uniq
      GRAIN_ORDER.select { |g| exposed.include?(g) }.map(&:to_s)
    end
  end
end
