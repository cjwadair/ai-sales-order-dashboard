module Reports
  # Runs a CompiledQuery and shapes the result into the Phase 1 response
  # envelope: { spec, title, data, columns:[{name,type}], meta }. Rows are cast
  # per the compiler's column metadata so the JSON dump carries real numbers and
  # ISO date strings rather than driver-specific objects.
  class Executor
    def execute(compiled, ir)
      sql = compiled.relation.to_sql
      result = ActiveRecord::Base.connection.select_all(sql)
      rows = result.to_a.map { |row| shape_row(row, compiled.columns) }

      limit = ir["limit"]
      {
        spec: ir,
        title: ir["title"],
        data: rows,
        columns: compiled.columns,
        meta: {
          row_count: rows.size,
          truncated: limit.present? && rows.size >= limit,
          unsupported_note: ir["unsupported_note"],
          sql_debug: sql,
        },
      }
    end

    private

    def shape_row(row, columns)
      columns.each_with_object({}) do |col, out|
        out[col[:name]] = cast(row[col[:name]], col[:type])
      end
    end

    def cast(value, type)
      return nil if value.nil?

      case type
      when :integer then value.to_i
      when :decimal then value.to_f
      when :date    then value.to_date.iso8601
      else value.to_s
      end
    rescue ArgumentError, TypeError, Date::Error
      value
    end
  end
end
