# Architecture & UML

The diagrams below document the main app flows, data model, and admin monitoring features.

## 1. Class Diagram

```mermaid
classDiagram
    direction LR

    class User {
        +int id
        +string name
        +string email
        +string hashed_password
        +string[] interests
        +UserRole role
        +bool is_active
        +register()
        +login()
        +updateProfile()
        +updateInterests()
        +changePassword()
    }

    class UserInterest {
        +int id
        +int user_id
        +string category
        +addInterest()
        +removeInterest()
    }

    class SavedTrip {
        +int id
        +int user_id
        +string name
        +object trip_data
        +datetime created_at
        +datetime updated_at
        +rename()
        +delete()
        +exportAsPdf()
    }

    class GeneratedTripData {
        +string destination
        +date start_date
        +date end_date
        +int budget_eur
        +int travelers
        +string currency
        +int total_estimated_cost_eur
        +saveToLibrary()
    }

    class ItineraryResponse {
        +string destination
        +string currency
        +int total_estimated_cost_eur
        +date start_date
        +date end_date
        +int budget_eur
        +DailySchedule[] days
        +validateSchedule()
        +normalizeCosts()
    }

    class DailySchedule {
        +int day_number
        +date date
        +Activity[] activities
        +requireThreeActivities()
    }

    class Activity {
        +string title
        +string description
        +string time_slot
        +int estimated_cost_eur
        +regenerate()
    }

    class BudgetOptimizerResponse {
        +string destination
        +int total_budget
        +int total_estimated_savings_eur
        +BudgetRecommendation[] recommendations
        +calculateSavings()
    }

    class BudgetRecommendation {
        +string category
        +string recommendation
        +string estimated_cost
        +string original_activity
        +int original_cost_eur
        +string suggested_alternative
        +int estimated_alternative_cost_eur
        +int estimated_savings_eur
        +string reason
    }

    class AIGenerationLog {
        +int id
        +string agent_name
        +string operation
        +string model
        +string destination
        +string status
        +int response_time_ms
        +string error_message
        +bool fallback_used
        +datetime created_at
        +recordSuccess()
        +recordFailure()
    }

    User "1" --> "0..*" UserInterest : has
    User "1" --> "0..*" SavedTrip : owns
    SavedTrip "1" *-- "1" GeneratedTripData : stores
    GeneratedTripData "1" o-- "1" ItineraryResponse : itinerary
    GeneratedTripData "0..1" o-- "1" BudgetOptimizerResponse : budget_optimization
    ItineraryResponse "1" *-- "1..*" DailySchedule : days
    DailySchedule "1" *-- "3" Activity : activities
    BudgetOptimizerResponse "1" *-- "0..*" BudgetRecommendation : recommendations
    Activity "0..1" --> "0..1" BudgetRecommendation : matched tip
    AIGenerationLog ..> ItineraryResponse : logs generation
    AIGenerationLog ..> BudgetOptimizerResponse : logs optimization
```

## 2. Use Case Diagram

```mermaid
flowchart LR
    User([User])

    subgraph Auth["Authentication"]
        Register["Create account<br/>POST /register"]
        Login["Log in<br/>POST /login"]
        Profile["Load profile<br/>GET /me"]
    end

    subgraph Planning["Trip planning"]
        EnterData["Enter destination, dates,<br/>travelers, and budget"]
        Generate["Generate AI itinerary<br/>POST /generate-itinerary"]
        ViewTimeline["Review vertical timeline<br/>ItineraryTimeline"]
    end

    subgraph Refinement["Itinerary refinement"]
        RefreshActivity["Refresh one activity<br/>POST /itinerary/regenerate-activity"]
        OptimizeBudget["Generate budget tips<br/>POST /optimize-budget"]
        SaveTrip["Save generated trip<br/>POST /saved-trips"]
    end

    subgraph Library["Saved trip library"]
        BrowseTrips["Browse saved trips<br/>GET /saved-trips"]
        RenameTrip["Rename saved trip<br/>PATCH /saved-trips/{id}"]
        DeleteTrip["Delete saved trip<br/>DELETE /saved-trips/{id}"]
        ExportPdf["Export itinerary as PDF<br/>buildSavedTripPdfHtml"]
    end

    User --> Register
    User --> Login
    Login --> Profile
    Profile --> EnterData
    EnterData --> Generate
    Generate --> ViewTimeline
    ViewTimeline --> RefreshActivity
    ViewTimeline --> OptimizeBudget
    ViewTimeline --> SaveTrip
    SaveTrip --> BrowseTrips
    User --> BrowseTrips
    BrowseTrips --> RenameTrip
    BrowseTrips --> DeleteTrip
    BrowseTrips --> ExportPdf

    Generate -. requires JWT .-> Login
    RefreshActivity -. requires existing itinerary .-> ViewTimeline
    OptimizeBudget -. uses most expensive paid activities .-> ViewTimeline
    ExportPdf -. available from saved trip details .-> BrowseTrips
```

## 3. Sequence Diagram: Generate New Itinerary

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Mobile App
    participant Backend as FastAPI Backend
    participant Ollama as Local Llama3/Ollama

    User->>App: Fill TripSearchForm
    User->>App: Press "Generate itinerary"
    App->>App: Validate destination, dates, travelers, budget
    App->>Backend: POST /generate-itinerary with JWT and trip data
    Backend->>Backend: get_current_user()
    Backend->>Backend: Read user interests and build structured JSON prompt
    Backend->>Ollama: POST /api/generate with model, prompt, JSON format

    alt Valid LLM JSON response
        Ollama-->>Backend: Raw itinerary JSON text
        Backend->>Backend: Parse, repair if needed, validate days and activities
        Backend->>Backend: Normalize dates, time slots, currency, and EUR costs
        Backend->>Backend: Record successful AIGenerationLog
        Backend-->>App: 200 ItineraryResponse
        App->>App: Add local dates, budget, travelers, and currency defaults
        App-->>User: Render ItineraryTimeline vertical timeline
    else LLM timeout or invalid itinerary JSON
        Backend->>Backend: Record failed AIGenerationLog
        Backend-->>App: 422 error detail
        App-->>User: Show trip generation error
    else Ollama connection error and offline fallback enabled
        Backend->>Backend: Record failed AIGenerationLog with fallback_used=true
        Backend->>Backend: Build offline itinerary fallback
        Backend-->>App: 200 fallback ItineraryResponse
        App-->>User: Render fallback timeline
    end
```

## 4. State Machine Diagram: Travel Itinerary Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> Authenticated: create account or login
    Authenticated --> Draft: open Home / TripSearchForm

    Draft --> Draft: edit destination, dates, travelers, budget
    Draft --> Generating: press Generate itinerary
    Generating --> Draft: cancel request
    Generating --> GenerationError: validation, backend, or LLM error
    GenerationError --> Draft: correct input and retry
    Generating --> Ready: ItineraryResponse rendered

    Ready --> BudgetOptimizing: press Optimize Budget
    BudgetOptimizing --> Ready: cancel or no paid activities
    BudgetOptimizing --> UnsavedChanges: budget tips attached
    BudgetOptimizing --> Ready: optimization error shown

    Ready --> RegeneratingActivity: press activity refresh
    RegeneratingActivity --> Ready: cancel or refresh error
    RegeneratingActivity --> UnsavedChanges: replacement activity applied

    Ready --> SavedToLibrary: save generated trip
    UnsavedChanges --> SavedToLibrary: save updated trip data
    UnsavedChanges --> RegeneratingActivity: refresh another activity
    UnsavedChanges --> BudgetOptimizing: optimize budget again

    SavedToLibrary --> ViewingSavedTrip: open Library and view trip
    ViewingSavedTrip --> ViewingSavedTrip: rename saved trip
    ViewingSavedTrip --> [*]: delete saved trip
    ViewingSavedTrip --> ExportingPDF: press Download PDF
    ExportingPDF --> ViewingSavedTrip: export failed or sharing unavailable
    ExportingPDF --> [*]: PDF saved or shared
```

## 5. Admin Use Case Diagram

```mermaid
flowchart LR
    Admin([Admin])
    SuperAdmin([Super Admin])

    subgraph Access["Role-gated admin access"]
        OpenAdmin["Open Admin Dashboard"]
        VerifyRole["Verify admin or super_admin role"]
    end

    subgraph Users["User management"]
        ViewUsers["View all users<br/>GET /admin/users"]
        ToggleStatus["Activate or deactivate user<br/>PATCH /admin/users/{user_id}/status"]
        UpdateRole["Update user role<br/>PATCH /admin/users/{user_id}/role"]
    end

    subgraph Usage["Usage statistics dashboard"]
        ViewStats["View system usage dashboard<br/>GET /admin/stats"]
        ViewPrometheus["View Prometheus-backed metrics<br/>requests, active requests, p95 latency, errors"]
        RenderCharts["Render dashboard metric tiles and charts"]
    end

    subgraph AI["AI agent monitoring"]
        MonitorAgents["Monitor Llama3 and Phi-3 agent performance<br/>GET /admin/ai-agent-metrics?limit=50"]
        ViewFailures["Inspect failed AI generations"]
        ViewLogs["Review recent generation logs"]
    end

    Admin --> OpenAdmin
    SuperAdmin --> OpenAdmin
    OpenAdmin --> VerifyRole
    VerifyRole --> ViewUsers
    VerifyRole --> ViewStats
    VerifyRole --> MonitorAgents
    ViewUsers --> ToggleStatus
    ViewStats --> ViewPrometheus
    ViewStats --> RenderCharts
    MonitorAgents --> ViewFailures
    MonitorAgents --> ViewLogs
    SuperAdmin --> UpdateRole
    ViewUsers --> UpdateRole

    UpdateRole -. super_admin only .-> SuperAdmin
    ToggleStatus -. admins cannot deactivate themselves .-> Admin
```

## 6. Sequence Diagram: Load Admin Usage Statistics Dashboard

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin User
    participant Frontend as Admin Frontend
    participant Backend as FastAPI Backend
    participant Prometheus as Prometheus Metrics Database
    participant DB as Backend Database

    Admin->>Frontend: Navigate to AdminStatsScreen
    Frontend->>Frontend: Check stored JWT and admin role
    Frontend->>Backend: GET /admin/stats with Bearer token
    Frontend->>Backend: GET /admin/ai-agent-metrics?limit=50 with Bearer token

    Backend->>Backend: require_roles(admin, super_admin)
    Backend->>Prometheus: Query total HTTP requests
    Backend->>Prometheus: Query active in-flight requests
    Backend->>Prometheus: Query p95 request latency
    Backend->>Prometheus: Query 4xx and 5xx error count
    Prometheus-->>Backend: Return request metric values
    Backend->>Backend: Format AdminStats response
    Backend-->>Frontend: total_requests, active_requests, p95_latency_ms, error_count

    Backend->>Backend: require_roles(admin, super_admin)
    Backend->>DB: Read recent AIGenerationLog rows
    DB-->>Backend: Return agent logs
    Backend->>Backend: Build summary, alerts, and log response
    Backend-->>Frontend: AdminAIAgentMetricsResponse

    Frontend->>Frontend: buildAdminUsageMetrics()
    Frontend->>Frontend: buildAIAgentPerformanceMetrics()
    Frontend-->>Admin: Render usage metrics, AI timings, alerts, and recent logs

    alt Prometheus unavailable or empty
        Backend-->>Frontend: Return zero-valued system stats
        Frontend-->>Admin: Render dashboard with fallback metric values
    else Unauthorized or non-admin user
        Backend-->>Frontend: 401 or 403 error
        Frontend-->>Admin: Show restricted access or error state
    end
```

## 7. Admin Class Diagram

```mermaid
classDiagram
    direction LR

    class User {
        +int id
        +string name
        +string email
        +string hashed_password
        +string[] interests
        +UserRole role
        +bool is_active
    }

    class Admin {
        +UserRole role = admin
        +viewDashboard()
        +manageUsers()
        +viewUsageStats()
        +monitorAIAgents()
    }

    class SuperAdmin {
        +UserRole role = super_admin
        +updateUserRole()
    }

    class AdminUser {
        +int id
        +string name
        +string email
        +UserRole role
        +bool is_active
        +toggleStatus()
        +changeRole()
    }

    class AdminStats {
        +int total_requests
        +int active_requests
        +float p95_latency_ms
        +int error_count
    }

    class AdminUsageMetric {
        +string key
        +string label
        +number value
        +string formattedValue
    }

    class AdminAIAgentMetricsResponse {
        +AdminAIAgentSummary summary
        +AdminAIAgentAlert[] alerts
        +AdminAIAgentLog[] logs
    }

    class AdminAIAgentSummary {
        +int itinerary_agent_response_time_ms
        +int budget_optimizer_agent_response_time_ms
        +int recent_failure_count
    }

    class AdminAIAgentLog {
        +int id
        +string agent_name
        +string metric_label
        +string operation
        +string destination
        +string model
        +string status
        +int response_time_ms
        +string error_message
        +bool fallback_used
        +datetime created_at
    }

    class AdminAIAgentAlert {
        +int id
        +string agent_name
        +string operation
        +string message
        +datetime created_at
    }

    class DashboardChart {
        +string title
        +string metricLabel
        +string formattedValue
        +renderMetricTile()
        +renderLogList()
    }

    User <|-- Admin : conceptual role
    Admin <|-- SuperAdmin : elevated role
    Admin --> "0..*" AdminUser : manages
    SuperAdmin --> "0..*" AdminUser : updates roles
    Admin --> AdminStats : views
    AdminStats --> "1..*" AdminUsageMetric : mapped to
    Admin --> AdminAIAgentMetricsResponse : monitors
    AdminAIAgentMetricsResponse *-- AdminAIAgentSummary : summary
    AdminAIAgentMetricsResponse *-- "0..*" AdminAIAgentLog : logs
    AdminAIAgentMetricsResponse *-- "0..*" AdminAIAgentAlert : alerts
    DashboardChart --> AdminUsageMetric : displays
    DashboardChart --> AdminAIAgentSummary : displays
    DashboardChart --> AdminAIAgentLog : lists
```