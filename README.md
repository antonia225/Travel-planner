# ✈️ AI Travel Planner

> *Your personal AI travel buddy — no agency fees, no boring itineraries.*

Ever stared at a blank browser tab trying to plan a trip? We've got you. Just tell the app where you want to go and for how long, and the AI does the rest — personalised day-by-day itineraries, smart budget breakdowns, and a place to save all your dream trips.

---

## What Can It Do?

| Feature | Description |
|---------|-------------|
| 🗺️ **Itinerary Generator** | Tell it your destination + how many days — get a full trip plan back in seconds |
| 💸 **Budget Optimiser** | Enter your total budget and let AI figure out where to splurge and where to save |
| 📌 **Saved Trips** | Save your generated trips and browse them later — upcoming and past |
| 🎯 **Travel Interests** | Pick what you're into (food, adventure, beaches, nightlife…) for personalised results |
| 🔐 **Auth** | Secure accounts so your trips are yours |

---

## What's Under the Hood?

- **React Native + Expo** — works on iOS & Android
- **FastAPI** — snappy Python backend
- **Ollama** — AI runs *locally* on your machine, no API keys needed
- **Docker** — one command spins up everything
- **Prometheus + Grafana** — monitoring dashboards included

---

## Getting Started

### You'll need

- **Node.js** (LTS)
- **Docker Desktop**
- **Expo Go** app on your phone

> Python is not required — Docker handles it all.

---

### Step 1 — Install frontend packages

```bash
cd frontend
npm install
cd ..
```

### Step 2 — Set up the environment file

**Mac / Linux:**
```bash
cp backend/.env.example backend/.env
```

**Windows:**
```powershell
Copy-Item backend/.env.example backend/.env
```

### Step 3 — Fire up the backend

```bash
docker compose up
```

This starts the API, the AI models, and the monitoring stack. The **first run downloads the AI models** so grab a coffee — it might take a few minutes. ☕

### Step 4 — Start the app

```bash
cd frontend
npm start
```

Scan the QR code with **Expo Go** and you're live!

---

## Testing on a Real Phone?

Your phone can't reach `localhost` on your computer, so you need to swap in your local IP address.

Find it with:
```bash
# Mac / Linux
ifconfig

# Windows
ipconfig
```

Then open `frontend/src/services/api.ts` and change:
```
http://localhost:8000  →  http://192.168.1.YOUR_IP:8000
```

---

## Services & Ports

| Service | URL | What's there |
|---------|-----|-------------|
| API | `localhost:8000` | Backend + interactive docs at `/docs` |
| Ollama | `localhost:11434` | Local AI inference |
| Grafana | `localhost:3000` | Dashboards (`admin` / `admin`) |
| Prometheus | `localhost:9090` | Raw metrics |

---

## Admin Usage Dashboard

The backend exposes an admin-only endpoint that returns aggregated usage metrics from Prometheus:

- `GET /admin/stats` — requires header `X-Admin-Token` to match the `ADMIN_API_TOKEN` environment variable set on the backend.

Environment variables:

- `ADMIN_API_TOKEN` — secret token required to query admin endpoints (set in `backend/.env`).
- `PROMETHEUS_URL` — URL for Prometheus (defaults to `http://prometheus:9090` in docker-compose).

The frontend includes an `AdminStatsScreen` that polls `/admin/stats` and shows Total Requests, Active Requests, P95 latency (ms) and Error Count.

## Running Tests

**Backend:**
```bash
docker compose exec backend pytest
```

**Frontend:**
```bash
cd frontend
npm test
```

---

## Project Layout

```
Travel-planner/
├── backend/          FastAPI app, AI services, database
├── frontend/         React Native / Expo app
├── monitoring/       Prometheus + Grafana config
└── docker-compose.yml
```

---

*Built with ❤️ as a university project.*