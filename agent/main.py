"""
FastAPI service exposing the Persian Collocation AI Tutor Agent.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8001

The Node backend proxies requests to this service internally (e.g.
http://127.0.0.1:8001/chat and http://127.0.0.1:8001/explain), so the
Gemini API key is kept strictly on the backend.
"""

from contextlib import asynccontextmanager

import logfire
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_ai.usage import UsageLimits

from agent import (
    AgentDeps,
    build_audit_agent,
    build_chatbot_agent,
    build_exercise_agent,
    build_model,
    format_chat_prompt,
    render_exercise_context,
)
from db import Database
from schemas import ChatRequest, ChatResponse, ExerciseJudgment
from settings import get_settings

settings = get_settings()
logfire.configure(
    service_name="hamvajeh-agent-service",
    token=settings.logfire_token,
    send_to_logfire="if-token-present",
)
logfire.instrument_pydantic_ai()


class AppState:
    db: Database
    chatbot_agent: object
    exercise_agent: object
    audit_agent: object


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    state.db = await Database.connect(settings.database_url)
    await state.db.ensure_agent_tables()

    model = build_model(settings.google_api_key)
    state.chatbot_agent = build_chatbot_agent(model)
    state.exercise_agent = build_exercise_agent(model)
    state.audit_agent = build_audit_agent(model)

    yield

    await state.db.close()


app = FastAPI(title="HamVajeh Persian Collocation AI Agent", lifespan=lifespan)
logfire.instrument_fastapi(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root() -> dict:
    """Root metadata endpoint providing status and documentation link."""
    return {
        "service": "HamVajeh AI Tutor Agent",
        "status": "online",
        "docs_url": "/docs",
        "endpoints": {
            "chat": "POST /chat",
            "explain": "POST /explain",
            "health": "GET /health",
        },
    }


def compute_chat_cache_key(message: str) -> str:
    normalized = " ".join(message.strip().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


CHAT_USAGE_LIMITS = UsageLimits(request_limit=8)


@app.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    """Conversational endpoint for the Persian Collocation AI Tutor ('هم‌یار')."""
    # 1) Check exact-match cache for initial queries to preserve Gemini daily quota
    cache_key = None
    if not payload.history:
        cache_key = compute_chat_cache_key(payload.message)
        cached = await state.db.get_cached_chat(cache_key)
        if cached is not None:
            return cached

    # 2) Execute Pydantic AI agent with real database tools and FallbackModel chain
    try:
        prompt = format_chat_prompt(payload.message, payload.history)
        result = await state.chatbot_agent.run(
            prompt, deps=AgentDeps(db=state.db), usage_limits=CHAT_USAGE_LIMITS
        )
        response: ChatResponse = result.output

        # 3) Store initial query in PostgreSQL cache for instant subsequent hits
        if cache_key is not None:
            await state.db.store_cached_chat(cache_key, payload.message, response)

        return response
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat generation failed: {str(e)}",
        )


class ExplainRequest(BaseModel):
    example_id: int
    selected_option_id: int


@app.post("/explain", response_model=ExerciseJudgment)
async def explain(payload: ExplainRequest) -> ExerciseJudgment:
    """Analyzes a user's quiz mistake against authentic corpus evidence."""
    # 1) Exact-match cache first - never pay for the same question twice
    cached = await state.db.get_cached_judgment(payload.example_id, payload.selected_option_id)
    if cached is not None:
        return cached

    # 2) Pull real evidence from Postgres
    evidence = await state.db.fetch_exercise_evidence(
        payload.example_id, payload.selected_option_id
    )
    if evidence is None:
        raise HTTPException(
            status_code=404,
            detail="No matching example/option pair found for the given ids.",
        )

    # 3) Ask the agent
    context = render_exercise_context(evidence)
    result = await state.exercise_agent.run(context)
    judgment = result.output

    # 4) Persist: cache the answer, and log a flag if the agent disagreed
    await state.db.store_cached_judgment(
        payload.example_id, payload.selected_option_id, judgment
    )
    if judgment.flag_for_review:
        await state.db.record_flag(
            collocation_id=evidence.collocation_id,
            example_id=evidence.example_id,
            reasoning=judgment.linguistic_reasoning,
        )

    return judgment


@app.get("/health")
async def health() -> dict:
    flags_today = await state.db.count_flags_today()
    return {
        "status": "ok",
        "service": "hamvajeh-agent",
        "flags_logged_today": flags_today,
    }
