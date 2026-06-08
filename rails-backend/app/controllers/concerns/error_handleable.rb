module ErrorHandleable
  extend ActiveSupport::Concern

  included do
    rescue_from ActiveRecord::RecordNotFound,       with: :not_found
    rescue_from ActiveRecord::RecordInvalid,        with: :unprocessable_content
    rescue_from ActionController::ParameterMissing, with: :bad_request
    rescue_from ArgumentError,                      with: :unprocessable_content
  end

  private

  def not_found(error)
    render_error(error.message, :not_found)
  end

  def unprocessable_entity(error)
    messages = error.respond_to?(:record) ? error.record.errors.full_messages : error.message
    render_error(messages, :unprocessable_content)
  end

  def bad_request(error)
    render_error(error.message, :bad_request)
  end

  def render_error(messages, status)
    render json: { errors: Array(messages) }, status:
  end
end
