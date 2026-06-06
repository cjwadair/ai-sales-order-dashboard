module Reports
  # Server-resolved relative-date tokens. The model never computes calendar
  # dates -- it emits a token from this closed set and the compiler resolves it
  # here, against the server clock. Each token resolves to a single Date,
  # suitable as the bound value for a comparison (e.g. `order_date >= year_start`).
  module RelativeDate
    TOKENS = %w[
      today month_start quarter_start year_start
      last_7_days last_30_days last_quarter last_month
    ].freeze

    module_function

    def valid?(token)
      TOKENS.include?(token.to_s)
    end

    def resolve(token)
      today = Date.current
      case token.to_s
      when "today"         then today
      when "month_start"   then today.beginning_of_month
      when "quarter_start" then today.beginning_of_quarter
      when "year_start"    then today.beginning_of_year
      when "last_7_days"   then today - 7
      when "last_30_days"  then today - 30
      when "last_quarter"  then (today.beginning_of_quarter - 1.day).beginning_of_quarter
      when "last_month"    then (today.beginning_of_month - 1.day).beginning_of_month
      else
        raise ArgumentError, "unknown relative-date token: #{token.inspect}"
      end
    end
  end
end
