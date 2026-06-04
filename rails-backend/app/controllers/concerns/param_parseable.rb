module ParamParseable
  extend ActiveSupport::Concern

  private

  def is_all_or_nil?(value)
    value.blank? || value == "All"
  end

  def parse_date_param(str)
    str.present? ? Date.parse(str) : nil
  end

  def parse_permitted_value_param(param_name, value, permitted_values)
    return nil if is_all_or_nil?(value)
    raise ArgumentError, "Invalid #{param_name}: #{value}" unless permitted_values.include?(value)
    value
  end

  def parse_sortable_param(param_name, value, permitted_values, default:)
    value = value.presence || default
    raise ArgumentError, "Invalid #{param_name}: #{value}" unless permitted_values.include?(value)
    value
  end
end
