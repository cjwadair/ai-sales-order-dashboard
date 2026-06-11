module Reports
  # Runs a CompiledQuery and shapes the result into the response envelope:
  # { spec, title, data, columns:[{name,type}], meta }. Rows are cast per the
  # compiler's column metadata so the JSON dump carries real numbers and ISO
  # date strings rather than driver-specific objects.
  #
  # Decimal columns are serialized as normalized strings (e.g. "1234.5") so
  # float rounding is never introduced. columns[].type == :decimal is the
  # signal Phase 3 consumers use to parse/format these values.
  #
  # Execution is wrapped in a transaction with SET LOCAL statement_timeout so
  # runaway queries are cancelled rather than hanging the process. Timeout is
  # read from Rails.application.config.x.reports.statement_timeout_ms
  # (configured in application.rb, overridable via REPORTS_STATEMENT_TIMEOUT_MS env).
  # ActiveRecord::QueryCanceled propagates to QueryService which maps it to 504.
  class Executor
    def execute(compiled, ir)
      sql = compiled.relation.to_sql
      conn = ActiveRecord::Base.connection

      result = ActiveRecord::Base.transaction do
        conn.execute("SET LOCAL statement_timeout = '#{statement_timeout_ms}ms'")
        conn.select_all(sql)
      end

      rows = result.to_a.map { |row| shape_row(row, compiled.columns) }

      meta = {
        row_count:      rows.size,
        truncated:      rows.size >= compiled.applied_limit,
        limit:          compiled.applied_limit,
        limit_defaulted: compiled.limit_defaulted,
        unsupported_note: ir["unsupported_note"],
      }
      meta[:sql_debug] = sql unless Rails.env.production?

      {
        spec:    ir,
        title:   ir["title"],
        data:    rows,
        columns: compiled.columns,
        meta:    meta,
      }
    end

    private

    def statement_timeout_ms
      Rails.application.config.x.reports.statement_timeout_ms
    end

    def shape_row(row, columns)
      columns.each_with_object({}) do |col, out|
        out[col[:name]] = cast(row[col[:name]], col[:type])
      end
    end

    def cast(value, type)
      return nil if value.nil?

      case type
      when :integer then value.to_i
      when :decimal then BigDecimal(value.to_s).to_s("F")
      when :date    then value.to_date.iso8601
      else value.to_s
      end
    rescue ArgumentError, TypeError, Date::Error
      value
    end
  end
end
