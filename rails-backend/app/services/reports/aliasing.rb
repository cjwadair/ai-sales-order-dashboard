module Reports
  # Output-name derivation for IR dimensions/measures, shared by the validator
  # (to compute the set of declared aliases for sort-ref checking) and the
  # compiler (to emit `AS <alias>`). Keeping it in one place guarantees the two
  # agree on what a column is called.
  module Aliasing
    module_function

    # Safe charset for a model-supplied `as:` alias. Anything outside this is
    # rejected by the validator -- aliases are embedded in SQL, so they are not
    # trusted free text.
    ALIAS_RE = /\A[a-zA-Z][a-zA-Z0-9_]*\z/

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

    def valid_alias?(name)
      name.to_s.match?(ALIAS_RE)
    end
  end
end
