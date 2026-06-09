module Reports
  # Loader for a reporting scope's semantic config (config/reports/<scope>.yml).
  #
  # The config is the single authority for the NL -> IR reporting engine. This
  # loader normalizes the raw YAML once and exposes three projections:
  #
  #   * glossary       -- human-readable entity/field listing for the tool description
  #   * compiler lookups -- field(entity, name) / relationship(name) / resolve(ref)
  #   * schema enums   -- enum_fields(role) for the generated tool schema
  #
  # Anything not present in the config is invisible to the model AND absent from
  # every lookup here -- that absence IS the access control.
  class SemanticConfig
    class ConfigError < StandardError; end

    CONFIG_DIR = Rails.root.join("config", "reports")
    VALID_ROLES = %i[dimension measure filter].freeze

    # Loaded + memoized per scope. The config file is the cache key in spirit;
    # call reset_cache! after editing YAML in development/tests.
    def self.for(scope = "sales")
      (@cache ||= {})[scope.to_s] ||= load(scope.to_s)
    end

    def self.load(scope)
      path = CONFIG_DIR.join("#{scope}.yml")
      raise ConfigError, "unknown reporting scope: #{scope.inspect}" unless File.exist?(path)

      new(YAML.safe_load_file(path, permitted_classes: [], aliases: true))
    end

    def self.reset_cache!
      @cache = {}
    end

    # The configured reporting scopes — one per config/reports/<scope>.yml.
    # The registry consumers (the "add a scope" playbook, and the Phase 1.7 scope
    # resolver) enumerate scopes through this rather than assuming "sales".
    def self.available_scopes
      Dir.glob(CONFIG_DIR.join("*.yml")).map { |path| File.basename(path, ".yml") }.sort
    end

    attr_reader :source_name, :dialect, :root_entity_name

    def initialize(raw)
      src = raw.fetch("source") { raise ConfigError, "config missing `source` block" }
      @source_name      = src.fetch("name")
      @dialect          = src.fetch("dialect", "postgres")
      @root_entity_name = src.fetch("root") { raise ConfigError, "config missing `source.root`" }

      @entities      = normalize_entities(raw.fetch("entities", {}))
      @relationships = normalize_relationships(raw.fetch("relationships", {}))

      unless @entities.key?(@root_entity_name)
        raise ConfigError, "root entity #{@root_entity_name.inspect} is not defined in `entities`"
      end
    end

    # ---- Compiler lookups -------------------------------------------------

    def entity_names
      @entities.keys
    end

    def entity(name)
      @entities[name.to_s]
    end

    def root_entity
      @entities[@root_entity_name]
    end

    def root?(entity_name)
      entity_name.to_s == @root_entity_name
    end

    # field(entity, name) -> { entity:, name:, column:, type:, roles:, table:, ... }
    # Returns nil when the entity or field is not exposed in the config.
    def field(entity_name, field_name)
      @entities.dig(entity_name.to_s, :fields, field_name.to_s)
    end

    # Resolve an IR field reference string into its normalized field hash.
    # Root fields are bare ("order_total"); related fields are dotted
    # ("sales_rep.name"). Returns nil for unknown / unexposed refs.
    def resolve(ref)
      entity_name, field_name =
        ref.to_s.include?(".") ? ref.to_s.split(".", 2) : [@root_entity_name, ref.to_s]
      field(entity_name, field_name)
    end

    # relationship(target) -> { from:, target:, kind:, foreign_key:, association:, table: }
    # Keyed by target entity name (Tier 1 = single hop from root).
    def relationship(target)
      @relationships[target.to_s]
    end

    def relationships
      @relationships
    end

    # ---- Schema-enum projection ------------------------------------------

    # Field reference strings exposed for the given role, e.g.
    #   enum_fields(:dimension) => ["order_number", "order_date", ..., "sales_rep.name"]
    # Root fields first (bare), then related fields (dotted), config order preserved.
    def enum_fields(role)
      role = role.to_sym
      refs = []
      each_field do |entity_name, field_data|
        refs << field_data[:ref] if field_data[:roles].include?(role)
      end
      refs
    end

    # ---- Glossary projection ---------------------------------------------

    # Structured glossary for rendering into the (cached) tool description.
    def glossary
      @entities.map do |entity_name, entity_data|
        {
          entity: entity_name,
          root: root?(entity_name),
          table: entity_data[:table],
          description: entity_data[:description],
          fields: entity_data[:fields].values.map do |f|
            {
              ref: f[:ref],
              type: f[:type],
              roles: f[:roles],
              aggregations: f[:aggregations],
              grains: f[:grains],
              values: f[:values],
            }.compact
          end,
        }.compact
      end
    end

    private

    def each_field
      @entities.each do |entity_name, entity_data|
        entity_data[:fields].each_value { |field_data| yield(entity_name, field_data) }
      end
    end

    def normalize_entities(raw_entities)
      raw_entities.each_with_object({}) do |(entity_name, entity_raw), acc|
        entity_name = entity_name.to_s
        table = entity_raw.fetch("table") { raise ConfigError, "entity #{entity_name.inspect} missing `table`" }
        fields = (entity_raw["fields"] || {}).each_with_object({}) do |(field_name, field_raw), facc|
          facc[field_name.to_s] = normalize_field(entity_name, field_name.to_s, table, field_raw)
        end

        acc[entity_name] = {
          name: entity_name,
          table: table,
          primary_key: entity_raw.fetch("primary_key", "id"),
          description: entity_raw["description"],
          fields: fields,
        }
      end
    end

    def normalize_field(entity_name, field_name, table, raw)
      roles = Array(raw.fetch("roles", [])).map(&:to_sym)
      bad_roles = roles - VALID_ROLES
      raise ConfigError, "field #{entity_name}.#{field_name} has invalid roles #{bad_roles.inspect}" if bad_roles.any?

      root = entity_name == @root_entity_name
      {
        entity: entity_name,
        name: field_name,
        ref: root ? field_name : "#{entity_name}.#{field_name}",
        column: raw.fetch("column", field_name),
        table: table,
        type: raw.fetch("type", "string").to_sym,
        roles: roles,
        aggregations: raw["aggregations"]&.map(&:to_sym),
        grains: raw["grains"]&.map(&:to_sym),
        values: raw["values"],
      }
    end

    def normalize_relationships(raw_relationships)
      raw_relationships.each_with_object({}) do |(key, rel_raw), acc|
        from, target = key.to_s.split("->").map(&:strip)
        raise ConfigError, "relationship key #{key.inspect} must be `<from> -> <target>`" if target.nil?

        acc[target] = {
          from: from,
          target: target,
          kind: rel_raw.fetch("kind").to_sym,
          foreign_key: rel_raw.fetch("foreign_key"),
          association: (rel_raw["association"] || default_association(target, rel_raw["kind"])).to_sym,
          table: @entities.dig(target, :table),
        }
      end
    end

    def default_association(target, kind)
      kind.to_s == "has_many" ? target.pluralize : target
    end
  end
end
