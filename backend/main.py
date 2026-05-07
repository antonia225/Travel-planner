from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.ai_service import check_ollama_connection

app = FastAPI(title="AI Travel Planner API")

# Development CORS policy; tighten in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ollama")
def ollama_health_check() -> dict[str, object]:
    return check_ollama_connection()
