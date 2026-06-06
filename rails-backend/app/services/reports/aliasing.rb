module Reports
  # Output-name derivation for IR dimensions/measures, shared by the validator
  # (to compute the set of declared aliases for sort-ref checking) and the
  # compiler (to emit `AS <alias>`). Keeping it in one place guarantees the two
  # agree on what a column is called.
  #
  # A model-supplied `as:` may be any human-readable label ("Total Sales"); the
  # compiler always emits it through `quote_column_name`, so an arbitrary string
  # is safe as a quoted SQL identifier -- no charset restriction is needed here.
  module Aliasing
    module_function

    def dimension_alias(dim)
      explicit = dim["as"]
      return explicit if explicit.present?

      base = dim["field"].to_s.tr(".", "_")
      dim["grain"].present? ? "#{base}_#{dim["grain"]}" : base
    end

    def measure_alias(measure)
      explicit = measure["as"]
      return explicit if explicit.present?

      fn = measure["fn"].to_s
      return "count" if fn == "count" && measure["field"].blank?

      "#{fn}_#{measure["field"].to_s.tr(".", "_")}"
    end
  end
end
