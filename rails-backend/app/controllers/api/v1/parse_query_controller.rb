class Api::V1::ParseQueryController < ApplicationController
  def create
    query = params[:query].to_s.strip
    return render json: { error: "query is required" }, status: :unprocessable_entity if query.blank?

    stop_words = %w[of in to me my by at is it do on or as an so up we us no if go the all for and not but show get find].to_set
    tokens = query.split(/\s+/)
      .map { |t| t.gsub(/[''’]s?\z/i, "").gsub(/[^a-zA-Z0-9\-]/, "") }
      .select { |t| t.length >= 2 && !stop_words.include?(t.downcase) }
      .uniq

    name_conditions = tokens.map { "name ILIKE ?" }.join(" OR ")
    name_values = tokens.map { |t| "%#{t}%" }

    matched_reps      = name_conditions.present? ? SalesRep.where(name_conditions, *name_values).pluck(:name) : []
    matched_customers = name_conditions.present? ? Consignee.where(name_conditions, *name_values).pluck(:name) : []

    history = (params[:history] || []).map(&:to_unsafe_h)
    messages = []
    history.each do |turn|
      filters = (turn["filters"] || {}).reject { |_, v| v.blank? }
      filter_summary = filters.map { |k, v| "#{k}: #{v}" }.join(", ")
      messages << { role: "user", content: turn["query"].to_s }
      messages << { role: "assistant", content: "I applied these filters: #{filter_summary.presence || 'none'}." }
    end
    messages << { role: "user", content: query }

    client = Anthropic::Client.new(
      api_key: Rails.application.credentials.anthropic[:api_key]
    )

    response = client.messages.create(
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: <<~PROMPT,
        You extract order filter parameters from natural language queries for an order management system.
        Today's date is #{Date.current}. All date ranges are inclusive on both ends. For relative ranges like 'last 30 days', set order_date_from to today minus 30 days and order_date_to to today.
        Return the complete set of filters that should be active after this query, merging any relevant context from the conversation history above. If the query is clearly starting fresh (a new topic with no reference to prior results), return only what the new query requires.

        Sales rep candidates matching this query: #{matched_reps.any? ? matched_reps.join(", ") : "none"}
        Customer candidates matching this query: #{matched_customers.any? ? matched_customers.join(", ") : "none"}

        When the query mentions a name, use these candidates to determine whether it refers to a sales rep or a customer. If a name appears in only one list, use that field. If it appears in both, prefer whichever is the closer match.
      PROMPT
      tools: [
        {
          name: "set_order_filters",
          description: "Set the filter parameters for the orders list based on the user's natural language query",
          input_schema: {
            type: "object",
            properties: {
              search: {
                type: "string",
                description: "Free text search across order number, customer, supplier, and sales rep"
              },
              status: {
                type: "string",
                enum: SalesOrder::STATUSES,
                description: "Filter by order status"
              },
              order_date_from: {
                type: "string",
                description: "Start of order date range (inclusive), ISO format YYYY-MM-DD"
              },
              order_date_to: {
                type: "string",
                description: "End of order date range (inclusive), ISO format YYYY-MM-DD"
              },
              delivery_date_from: {
                type: "string",
                description: "Start of delivery date range (inclusive), ISO format YYYY-MM-DD"
              },
              delivery_date_to: {
                type: "string",
                description: "End of delivery date range (inclusive), ISO format YYYY-MM-DD"
              },
              sales_rep: {
                type: "string",
                description: "Filter by exact sales rep name"
              },
              customer: {
                type: "string",
                description: "Filter by exact customer name"
              },
              order_total_min: {
                type: "number",
                description: "Minimum order total for filtering"
              },
              order_total_max: {
                type: "number",
                description: "Maximum order total for filtering"
              },
              sort_by: {
                type: "string",
                enum: SalesOrder::SORTABLE_COLUMNS + SalesOrder::ASSOCIATION_SORT_MAP.keys,
                description: "Column to sort results by"
              },
              sort_order: {
                type: "string",
                enum: %w[asc desc],
                description: "Sort direction: asc for ascending, desc for descending"
              }
            }
          }
        }
      ],
      tool_choice: { type: "tool", name: "set_order_filters" },
      messages: messages
    )

    puts "Anthropic response: #{response.content.find { |c| c.is_a?(Anthropic::Models::ToolUseBlock) }.input} }"

    tool_use_block = response.content.find { |c| c.is_a?(Anthropic::Models::ToolUseBlock) }
    raise "No tool_use block in response" unless tool_use_block

    render json: tool_use_block.input
  rescue Anthropic::APIError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end
end
