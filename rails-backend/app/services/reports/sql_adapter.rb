module Reports
  # SQL adapter — owns constructs that vary between database engines.
  # Currently postgres-only. Add a new `when` branch in `.for` (and the
  # corresponding method implementations) when a second engine is needed.
  class SqlAdapter
    def self.for(name)
      case name.to_s
      when "postgres", "postgresql", "PostgreSQL" then new
      else raise ArgumentError, "unknown database adapter: #{name.inspect}"
      end
    end

    # Returns an Arel node for date_trunc('<grain>', <attr>).
    # `grain` is a validator-whitelisted token (day/week/month/quarter/year), safe to embed.
    def date_trunc(grain, attr)
      Arel::Nodes::NamedFunction.new("date_trunc", [Arel.sql("'#{grain}'"), attr])
    end
  end
end
