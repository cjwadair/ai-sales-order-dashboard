module Reports
  # Routes a generic ("ask anything" / Chat) request to exactly one configured
  # scope, BEFORE generation (the chosen scope selects which config's cached schema
  # prefix is used). Focused endpoints pin their scope and never call this.
  #
  # Resolution ladder (cheapest first):
  #   1. Single scope      -> return it (no work).
  #   2. hints.page match  -> honor it deterministically (authoritative, no override gate).
  #   3. LLM classifier    -> cheap-model tiebreaker over all scopes; ambiguity is surfaced
  #                           in `meta` (best-effort, never asks). Falls back to DEFAULT_SCOPE
  #                           when the classifier cannot return a usable result.
  class ScopeResolver
    DEFAULT_SCOPE = "sales"

    # Surfaced into the response envelope's `meta.routing` so a client/UI can see
    # which scope ran and whether the choice was ambiguous.
    Result = Struct.new(:scope, :ambiguous, :candidates, keyword_init: true) do
      def meta
        { scope: scope, ambiguous: ambiguous, candidates: candidates }
      end
    end

    def initialize(available_scopes: nil, page_index: nil, classifier: nil)
      @available_scopes = available_scopes || SemanticConfig.available_scopes
      @page_index = page_index || SemanticConfig.page_index
      @classifier = classifier || ScopeClassifier.new
    end

    # query - the NL utterance (String); hints - advisory bias ({ "page" => ... }).
    def resolve(query, hints: {})
      # 1. Nothing to route between.
      return resolved(@available_scopes.first) if @available_scopes.size <= 1

      # 2. Honor hints.page deterministically.
      page_scope = @page_index[(hints[:page] || hints["page"]).to_s]
      return resolved(page_scope) if page_scope

      # 3. LLM classifier over all scopes; explicit fallback to default scope.
      pick = @classifier.classify(query, scopes: @available_scopes)
      scope = @available_scopes.include?(pick) ? pick : DEFAULT_SCOPE
      Result.new(scope: scope, ambiguous: @available_scopes.size > 1, candidates: @available_scopes)
    end

    private

    def resolved(scope)
      Result.new(scope: scope, ambiguous: false, candidates: [scope])
    end
  end
end
