# ✈️ AI Travel Planner

> *Your personal AI travel buddy — no agency fees, no boring itineraries.*

Ever stared at a blank browser tab trying to plan a trip? This app helps you go from “maybe Paris?” to a full day-by-day itinerary, budget tips, saved trips, and PDF exports. It uses a React Native / Expo mobile app, a FastAPI backend, and local Ollama models, so you can build and test the whole thing without paid AI API keys. 🌍

---

## Table of Contents

- [What You Can Do](#what-you-can-do)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Running on a Real Phone](#running-on-a-real-phone)
- [Using the App](#using-the-app)
- [Demo Accounts](#demo-accounts)
- [Services & Ports](#services--ports)
- [Configuration](#configuration)
- [Admin & Monitoring](#admin--monitoring)
- [Running Tests](#running-tests)
- [Project Layout](#project-layout)
- [Architecture & UML](#architecture--uml)

---

## What You Can Do

| Feature | Description |
|---------|-------------|
| 🗺️ **AI Itinerary Generator** | Enter a destination, dates, travelers, and budget, then get a structured daily plan. |
| 💸 **Budget Optimizer** | Ask the AI for cheaper alternatives to the most expensive paid activities. |
| 🔁 **Activity Refresh** | Replace one activity without throwing away the whole itinerary. |
| 📌 **Saved Trip Library** | Save generated trips, rename them, delete them, and review them later. |
| 📄 **PDF Export** | Download or share saved itineraries as PDFs from the library screen. |
| 🎯 **Travel Interests** | Save preferences like food, nature, nightlife, culture, family-friendly, and more. |
| 🔐 **Auth & Profiles** | Register, log in, update your profile, and change your password. |
| 🛡️ **Admin Dashboard** | Manage users, roles, account status, AI logs, and backend usage metrics. |

---

## Tech Stack

| Layer | Tools |
|-------|-------|
| 📱 Mobile app | React Native, Expo, TypeScript, NativeWind, lucide-react-native |
| ⚙️ Backend API | FastAPI, SQLAlchemy, Pydantic, PyJWT, bcrypt |
| 🤖 Local AI | Ollama with `llama3` and `phi3` pulled by Docker Compose |
| 📊 Monitoring | Prometheus, Grafana, `prometheus-fastapi-instrumentator` |
| 🧪 Tests | Pytest for backend, Jest + jest-expo for frontend |
| 🐳 Dev runtime | Docker Compose for backend, Ollama, Prometheus, and Grafana |

---

## Quick Start

### 1. Install the essentials

- **Docker Desktop** 🐳
- **Node.js LTS** and npm
- **Expo Go** on your phone, if you want to test on a real device

> Python is only needed if you decide to run the backend outside Docker. The normal setup below uses Docker for the backend.

### 2. Install the frontend packages

```bash
cd frontend
npm install
cd ..
```

### 3. Create the backend environment file

Mac / Linux:

```bash
cp backend/.env.example backend/.env
```

Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

For local development, the defaults are ready to go. Before sharing or deploying anything, change `JWT_SECRET_KEY` in `backend/.env`. 🔑

### 4. Start the backend stack

```bash
docker compose up
```

This starts FastAPI, Ollama, Prometheus, and Grafana. On the first run, Docker also pulls the `llama3` and `phi3` Ollama models, so the first startup can take a few minutes. ☕

### 5. Start the Expo app

Open a second terminal:

```bash
cd frontend
npm start
```

Then scan the QR code with **Expo Go**, or use the Expo terminal options to open Android, iOS, or web.

---

## Running on a Real Phone

Your phone and computer must be on the same network. The app auto-detects the Expo dev host and uses port `8000`, so you usually do **not** need to edit `frontend/src/services/api.ts`.

If auto-detection fails, create `frontend/.env.local`:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_WIFI_IP:8000
```

Then restart Expo. On Windows, find your IP with `ipconfig`; on macOS, `ipconfig getifaddr en0` is usually the quickest option. 📱

---

## Using the App

1. **Log in or register** 🔐  
   The backend seeds demo users on startup, but you can also create your own account from the app.

2. **Choose your interests** 🎯  
   Update your profile with travel preferences so generated plans feel more like you.

3. **Generate a trip** ✨  
   On Home, enter a destination, start date, end date, traveler count, and budget. The app sends those details to `POST /generate-itinerary`.

4. **Refine the itinerary** 🔁  
   Refresh individual activities, then use **Optimize Budget** to get cheaper alternatives for high-cost activities.

5. **Save and export** 📌  
   Save the result to your library, reopen it later, rename it, delete it, or export it as a PDF.

6. **Use admin tools** 🛡️  
   Admin users can manage accounts and open the AI Agent Performance screen for model timing, failed generations, recent logs, and backend health.

---

## Demo Accounts

These are created automatically when the backend starts. They are meant for development and demos only. 🙂

| Role | Name | Email | Password |
|------|------|-------|----------|
| `super_admin` | Elena Super Admin | `elena.super.admin@example.com` | `ElenaSuperAdmin1` |
| `admin` | Andrei Admin | `andrei.admin@example.com` | `AndreiAdmin1` |
| `admin` | Maria Admin | `maria.admin@example.com` | `MariaAdmin1` |
| `user` | Emma Ionescu | `emma.ionescu@example.com` | `EmmaUser1` |
| `user` | Alex Popescu | `alex.popescu@example.com` | `AlexUser1` |
| `user` | Sofia Marin | `sofia.marin@example.com` | `SofiaUser1` |
| `user` | David Georgescu | `david.georgescu@example.com` | `DavidUser1` |

---

## Services & Ports

| Service | URL | What's there |
|---------|-----|--------------|
| FastAPI | `http://localhost:8000` | Backend API, health check at `/health`, docs at `/docs` |
| Ollama | `http://localhost:11434` | Local AI inference for `llama3` and `phi3` |
| Prometheus | `http://localhost:9090` | Raw backend metrics |
| Grafana | `http://localhost:3000` | Provisioned dashboards, default login `admin` / `admin` |

---

## Configuration

The main backend settings live in `backend/.env`.

| Variable | What it controls | Default for Docker |
|----------|------------------|--------------------|
| `DATABASE_URL` | SQLite database path | `./travel.db` |
| `JWT_SECRET_KEY` | JWT signing secret | Replace this for real use |
| `AI_AGENT_PROVIDER` | AI provider selection | `ollama` |
| `OLLAMA_BASE_URL` | Backend-to-Ollama URL | `http://ollama:11434` |
| `OLLAMA_MODEL` | General model | `llama3` |
| `OLLAMA_ITINERARY_MODEL` | Itinerary model | `phi3` |
| `OLLAMA_FALLBACK_MODEL` | Fallback model | `phi3` |
| `PROMETHEUS_URL` | Backend-to-Prometheus URL | `http://prometheus:9090` |
| `ENABLE_METRICS_ENDPOINT` | Exposes `/metrics` for Prometheus | `true` |
| `GF_SECURITY_ADMIN_USER` | Grafana username | `admin` |
| `GF_SECURITY_ADMIN_PASSWORD` | Grafana password | `admin` |

If you run the backend directly on your computer instead of Docker, change `OLLAMA_BASE_URL` to `http://localhost:11434`.

---

## Admin & Monitoring

Admins and super admins can open the admin area from the Home screen. The backend protects these routes with role checks:

- `GET /admin/users`
- `PATCH /admin/users/{user_id}/status`
- `PATCH /admin/users/{user_id}/role` — super admin only
- `GET /admin/stats`
- `GET /admin/ai-agent-metrics?limit=50`

Prometheus scrapes the backend `/metrics` endpoint, and Grafana loads the dashboard provisioning from `monitoring/grafana/provisioning`. The app's **AI Agent Performance** screen polls the admin stats and AI metrics endpoints every 10 seconds. 📈

---

## Running Tests

Backend tests:

```bash
docker compose exec backend pytest
```

Frontend tests:

```bash
cd frontend
npm test
```

You can also run the Expo TypeScript check from the frontend folder:

```bash
npx tsc --noEmit
```

---

## Project Layout

```text
Travel-planner/
├── backend/          FastAPI app, AI services, database models, tests
├── frontend/         Expo / React Native app, screens, components, tests
├── monitoring/       Prometheus and Grafana provisioning
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Architecture & UML

The diagrams below document the main app flows, data model, and admin monitoring features.

### 1. Class Diagram

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

### 2. Use Case Diagram

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

### 3. Sequence Diagram: Generate New Itinerary

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

### 4. State Machine Diagram: Travel Itinerary Lifecycle

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

### 5. Admin Use Case Diagram

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

### 6. Sequence Diagram: Load Admin Usage Statistics Dashboard

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

### 7. Admin Class Diagram

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

---

*Built with ❤️ as a university project. Have fun planning the next escape. 🌤️*
