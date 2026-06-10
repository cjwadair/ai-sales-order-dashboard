module Reports
  # Routes a generic ("ask anything" / Chat) request to exactly one configured
  # scope, BEFORE generation (the chosen scope selects which config's cached schema
  # prefix is used). Focused endpoints pin their scope and never call this.
  #
  # Resolution ladder (cheapest first; the LLM is a last resort):
  #   1. Single scope            -> return it (no work).
  #   2. hints.page honored      -> the page's scope, UNLESS the query lexically
  #                                 looks more like another scope (gated override).
  #   3. Clear lexical winner    -> that scope (no LLM).
  #   4. Tie / no signal         -> cheap-LLM classifier breaks the tie; ambiguity
  #                                 is surfaced in `meta` (best-effort, never asks).
  class ScopeResolver
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

      scores = affinity_scores(query)
      top = scores.values.max
      leaders = @available_scopes.select { |s| scores[s] == top }

      # 2. Honor hints.page unless the query is lexically pulled to another scope.
      page_scope = @page_index[hints_page(hints)]
      return resolved(page_scope) if page_scope && scores[page_scope] >= top

      # 3. A single scope clearly dominates the query's vocabulary.
      return resolved(leaders.first) if leaders.size == 1 && top.positive?

      # 4. Genuine tie (or no lexical signal at all) -> let the classifier decide.
      candidates = top.positive? ? leaders : @available_scopes
      pick = @classifier.classify(query, scopes: candidates)
      Result.new(scope: pick, ambiguous: candidates.size > 1, candidates: candidates)
    end

    private

    def resolved(scope)
      Result.new(scope: scope, ambiguous: false, candidates: [scope])
    end

    def hints_page(hints)
      (hints[:page] || hints["page"]).to_s
    end

    # How many of the query's tokens appear in each scope's vocabulary.
    def affinity_scores(query)
      tokens = SemanticConfig.tokenize(query).to_set
      @available_scopes.index_with { |scope| (tokens & SemanticConfig.for(scope).vocabulary).size }
    end
  end
end
