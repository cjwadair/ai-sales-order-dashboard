Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :sales_orders, only: [:index, :show]
      resources :consignees, only: [:index, :show]
      resources :suppliers, only: [:index, :show]
      get :filter_options, to: 'filter_options#index'
      post :parse_query, to: 'parse_query#create'
      post 'reports/query', to: 'reports#query'                # generic (Chat); scope resolved per request
      post 'reports/orders_query', to: 'reports#orders_query'  # focused sales endpoint
    end
  end
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Defines the root path route ("/")
  # root "posts#index"
end
