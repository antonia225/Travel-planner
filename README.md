# AI Travel Planner

AI Travel Planner is a university software project with a React Native mobile app and a FastAPI backend. The backend runs in Docker and integrates with Ollama for local AI model inference. The setup is designed so teammates can install frontend dependencies once, then run the backend stack with Docker Compose.

## Prerequisites

- Node.js (LTS recommended)
- Docker Desktop
- Expo Go app on your phone
- Python is **not** required on your local machine

## Setup After Cloning

1. Install frontend dependencies (one time only):

```bash
cd frontend
npm install
cd ..
```

2. Create backend environment file from the template:

Mac/Linux:

```bash
cp backend/.env.example backend/.env
```

Windows PowerShell:

```powershell
Copy-Item backend/.env.example backend/.env
```

3. Start backend + Ollama from the repository root:

```bash
docker compose up
```

4. Start Expo from `frontend/`:

```bash
cd frontend
npm start
```

5. Scan the QR code with Expo Go.

## Physical Device API URL Note

When testing on a physical phone, update `frontend/src/services/api.ts` and replace `http://localhost:8000` with your computer's local IP, for example `http://192.168.1.X:8000`.

Find your local IP:

Mac:

```bash
ifconfig
```

Windows:

```powershell
ipconfig
```
