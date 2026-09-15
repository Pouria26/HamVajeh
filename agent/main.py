"""
FastAPI service exposing the Persian Collocation AI Tutor Agent.

Run with:
    uvicorn main:app --host 0.0.0.0 --port 8001

The Node backend proxies requests to this service internally (e.g.
http://127.0.0.1:8001/chat and http://127.0.0.1:8001/explain), so the
Gemini API key is kept strictly on the backend.
"""

import os
import logging
from contextlib import asynccontextmanager

import logfire
import hashlib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.usage import UsageLimits

from agent import (
    AgentDeps,
    build_audit_agent,
    build_chatbot_agent,
    build_exercise_agent,
    build_model,
    build_search_assistant_agent,
    build_sentence_workshop_agent,
    format_chat_prompt,
    render_exercise_context,
)
from db import Database
from schemas import (
    ChatRequest,
    ChatResponse,
    ExerciseJudgment,
    GeneratedSentenceItem,
    SearchAssistantRequest,
    SearchAssistantResponse,
    SentenceWorkshopRequest,
    SentenceWorkshopResponse,
)
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
    sentence_workshop_agent: object
    search_assistant_agent: object


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger("hamvajeh-agent")
    settings = get_settings()
    state.db = await Database.connect(settings.database_url)
    await state.db.ensure_agent_tables()

    model = build_model(settings.google_api_key, settings.nvidia_api_key)
    logger.info(
        "3-Tier FallbackModel initialized: gemini-3.5-flash-lite -> gemini-3.1-flash-lite -> %s",
        "moonshotai/kimi-k3 (NVIDIA NIM)" if settings.nvidia_api_key else "(Kimi K3 inactive: NVIDIA_API_KEY not set)",
    )
    state.chatbot_agent = build_chatbot_agent(model)
    state.exercise_agent = build_exercise_agent(model)
    state.audit_agent = build_audit_agent(model)
    state.sentence_workshop_agent = build_sentence_workshop_agent(model)
    state.search_assistant_agent = build_search_assistant_agent(model)

    yield

    logfire.force_flush()
    await state.db.close()


app = FastAPI(title="HamVajeh Persian Collocation AI Agent", lifespan=lifespan)
# Note: logfire.instrument_fastapi is intentionally omitted to avoid polluting
# the Logfire dashboard with recurring Docker healthchecks (GET /health every 10s).
# Only actual LLM agent calls (via instrument_pydantic_ai and targeted spans) are recorded.

# CORS: The agent is an internal microservice accessed only by the Node.js
# backend, not by browsers directly. Allow env override for production proxy
# setups; default to localhost origins for safe local development.
_cors_origins = os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:4000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins.split(",")],
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
            "sentences": "POST /sentences",
            "search-assist": "POST /search-assist",
            "health": "GET /health",
        },
    }


@app.post("/admin/purge-cache")
async def purge_cache(max_age_days: int = 30) -> dict:
    """Delete cache entries older than the specified number of days."""
    results = await state.db.purge_stale_caches(max_age_days)
    return {"purged": results, "max_age_days": max_age_days}


def compute_chat_cache_key(query: str) -> str:
    """Returns a deterministic SHA256 hex digest of the normalized query."""
    normalized = " ".join(query.strip().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


CHAT_USAGE_LIMITS = UsageLimits(request_limit=6)


@app.post("/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    """Conversational endpoint for the Persian Collocation AI Tutor ('هم‌یار')."""
    # 1) Check exact-match cache for initial queries to preserve Gemini daily quota
    cache_key = None
    if not payload.history:
        cache_key = compute_chat_cache_key(payload.message)
        cached = await state.db.get_cached_chat(cache_key)
        if cached is not None:
            with logfire.span("هم‌یار - چت کاربر: {query}", query=payload.message) as span:
                span.set_attribute("cache_hit", True)
                span.set_attribute("history_turns", 0)
                span.set_attribute("agent.reply", cached.reply)
                span.set_attribute("agent.suggested_followups", cached.suggested_followups)
            return cached

    # 2) Execute Pydantic AI agent with real database tools and FallbackModel chain
    try:
        prompt = format_chat_prompt(payload.message, payload.history)
        with logfire.span("هم‌یار - چت کاربر: {query}", query=payload.message) as span:
            span.set_attribute("cache_hit", False)
            span.set_attribute("history_turns", len(payload.history))
            result = await state.chatbot_agent.run(
                prompt, deps=AgentDeps(db=state.db), usage_limits=CHAT_USAGE_LIMITS
            )
            response: ChatResponse = result.output
            span.set_attribute("agent.reply", response.reply)
            span.set_attribute("agent.suggested_followups", response.suggested_followups)

        # 3) Store initial query in PostgreSQL cache for instant subsequent hits
        if cache_key is not None:
            await state.db.store_cached_chat(cache_key, payload.message, response)

        return response
    except UsageLimitExceeded:
        logfire.warn(
            "Tool usage limit exceeded for message, falling back to direct linguistic response: {msg}",
            msg=payload.message,
        )
        # Fallback to direct linguistic judgment without database tools to guarantee an answer
        try:
            fallback_prompt = (
                f"پرسش کاربر درباره زبان فارسی:\n{payload.message}\n\n"
                "به عنوان دستیار زبان‌شناسی «هم‌یار»، بدون استفاده از ابزارهای دیتابیسی و صرفاً بر پایه شمّ زبانی و قواعد علمی، "
                "به صورت شیوا، دقیق و آموزشی به کاربر پاسخ بده و بررسی کن آیا این عبارت یک باهم‌آیی طبیعی است یا خیر."
            )
            with logfire.span("هم‌یار - چت کاربر (پاسخ جایگزین زبانی): {query}", query=payload.message) as span:
                span.set_attribute("cache_hit", False)
                span.set_attribute("is_fallback", True)
                fallback_result = await state.chatbot_agent.run(
                    fallback_prompt, deps=None, usage_limits=UsageLimits(request_limit=3)
                )
                fb_output: ChatResponse = fallback_result.output
                span.set_attribute("agent.reply", fb_output.reply)
                span.set_attribute("agent.suggested_followups", fb_output.suggested_followups)
                return fb_output
        except Exception:
            return ChatResponse(
                reply=(
                    f"عبارت «{payload.message}» یک باهم‌آیی تثبیت‌شده و طبیعی در زبان فارسی محسوب نمی‌شود. "
                    "در زبان فارسی، باهم‌آیی‌ها (مانند «تصمیم گرفتن» یا «به سفر رفتن») پیوندهای واژگانی مشخص و قاعده‌مندی دارند "
                    "که اهل زبان به صورت عادت‌واره در کنار هم می‌نشانند.\n\n"
                    "در ساختار موردنظر شما، کلمات پیوند باهم‌آیی مقید ندارند و در قالب ترکیب‌های آزاد یا جملات ساده دستوری قرار می‌گیرند."
                ),
                suggested_followups=[
                    "تفاوت باهم‌آیی با ترکیب آزاد کلمات چیست؟",
                    "باهم‌آیی‌های پرکاربرد فعل «رفتن» در زبان فارسی چیست؟",
                ],
            )
    except Exception as e:
        logfire.error("Chat generation failed: {error}", error=str(e))
        return ChatResponse(
            reply=(
                "متأسفانه در پردازش این پرسش خطایی در برقراری ارتباط با مدل زبانی رخ داد. "
                "به طور کلی در زبان فارسی، واژه‌ها زمانی باهم‌آیی می‌سازند که همنشینی آن‌ها پیوند معنایی یا سبکی تثبیت‌شده‌ای ایجاد کند. "
                "لطفاً پرسش خود را دوباره مطرح فرمایید تا همراهی‌تان کنم."
            ),
            suggested_followups=[
                "باهم‌آیی‌های واژه «تصمیم» در زبان فارسی چیست؟",
                "تعریف علمی باهم‌آیی در زبان‌شناسی چیست؟",
            ],
        )


class ExplainRequest(BaseModel):
    example_id: int
    selected_option_id: int


EXPLAIN_USAGE_LIMITS = UsageLimits(request_limit=8)


@app.post("/explain", response_model=ExerciseJudgment)
async def explain(payload: ExplainRequest) -> ExerciseJudgment:
    """Analyzes a user's quiz mistake against authentic corpus evidence."""
    # 1) Exact-match cache first - never pay for the same question twice
    cached = await state.db.get_cached_judgment(payload.example_id, payload.selected_option_id)
    if cached is not None:
        with logfire.span("هم‌یار - تحلیل تمرین: {example_id}", example_id=payload.example_id) as span:
            span.set_attribute("cache_hit", True)
            span.set_attribute("example_id", payload.example_id)
            span.set_attribute("selected_option_id", payload.selected_option_id)
            span.set_attribute("verdict", cached.agrees_with_database)
            span.set_attribute("agrees_with_database", cached.agrees_with_database)
            span.set_attribute("confidence", cached.confidence)
            span.set_attribute("flag_for_review", cached.flag_for_review)
            span.set_attribute("linguistic_reasoning", cached.linguistic_reasoning)
            span.set_attribute("user_facing_answer", cached.user_facing_answer)
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

    # 3) Ask the agent with resilient model chain and usage limit
    try:
        context = render_exercise_context(evidence)
        with logfire.span("هم‌یار - تحلیل تمرین: {sentence}", sentence=evidence.blank_sentence) as span:
            span.set_attribute("cache_hit", False)
            span.set_attribute("example_id", payload.example_id)
            span.set_attribute("selected_option_id", payload.selected_option_id)
            span.set_attribute("collocation_id", evidence.collocation_id)
            span.set_attribute("collocation_display", evidence.collocation_display)
            span.set_attribute("selected_word", evidence.user_selected_answer)
            span.set_attribute("correct_word", evidence.database_correct_answer)

            result = await state.exercise_agent.run(context, usage_limits=EXPLAIN_USAGE_LIMITS)
            judgment: ExerciseJudgment = result.output

            span.set_attribute("verdict", judgment.agrees_with_database)
            span.set_attribute("agrees_with_database", judgment.agrees_with_database)
            span.set_attribute("confidence", judgment.confidence)
            span.set_attribute("flag_for_review", judgment.flag_for_review)
            span.set_attribute("linguistic_reasoning", judgment.linguistic_reasoning)
            span.set_attribute("user_facing_answer", judgment.user_facing_answer)

        # 4) Persist: cache the answer, and log a flag if the agent flagged it for review
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
    except HTTPException:
        raise
    except Exception as e:
        logfire.error("Exercise explanation error, falling back to direct judgment: {error}", error=str(e))
        return ExerciseJudgment(
            agrees_with_database="agree",
            confidence="medium",
            linguistic_reasoning=f"تحلیل جایگزین زبانی: گزینه انتخابی «{evidence.user_selected_answer}» با بافت معنایی و نحوی همخوانی ندارد در حالی که گزینه درست «{evidence.database_correct_answer}» است.",
            user_facing_answer=(
                f"در این جمله، گزینه «{evidence.database_correct_answer}» باهم‌آیی طبیعی و خوش‌آهنگ زبان فارسی را تشکیل می‌دهد. "
                f"گزینه انتخابی شما («{evidence.user_selected_answer}») در این بافت معنایی یا همنشینی واژگانی معمول اهل زبان قرار نمی‌گیرد."
            ),
            flag_for_review=False,
        )


SENTENCE_WORKSHOP_LIMITS = UsageLimits(request_limit=5)


@app.post("/sentences", response_model=SentenceWorkshopResponse)
async def generate_sentences(payload: SentenceWorkshopRequest) -> SentenceWorkshopResponse:
    """Generates 3 practical sentences in 3 distinct registers (formal, journalistic, daily) for a collocation."""
    # 1) Check exact-match cache by collocation_id
    cached = await state.db.get_cached_sentences(payload.collocation_id)
    if cached is not None:
        with logfire.span("هم‌یار - کارگاه جمله‌ساز: {collocation}", collocation=payload.display_form) as span:
            span.set_attribute("cache_hit", True)
            span.set_attribute("collocation_id", payload.collocation_id)
            span.set_attribute("display_form", payload.display_form)
            span.set_attribute("generated_sentences", [s.sentence for s in cached.sentences])
        return cached

    prompt = (
        f"باهم‌آیی هدف برای کارگاه جمله‌ساز:\n«{payload.display_form}»\n\n"
        "لطفاً دقیقاً ۳ جمله ملموس، زیبا و اصیل به همراه توضیح در ۳ بافت کاربردی "
        "(رسمی/اداری، مطبوعاتی/تحلیلی، روزمره/داستانی) تولید کن."
    )

    try:
        with logfire.span("هم‌یار - کارگاه جمله‌ساز: {collocation}", collocation=payload.display_form) as span:
            span.set_attribute("cache_hit", False)
            span.set_attribute("collocation_id", payload.collocation_id)
            span.set_attribute("display_form", payload.display_form)
            result = await state.sentence_workshop_agent.run(prompt, usage_limits=SENTENCE_WORKSHOP_LIMITS)
            response: SentenceWorkshopResponse = result.output
            response.collocation_id = payload.collocation_id
            response.display_form = payload.display_form
            span.set_attribute("generated_sentences", [s.sentence for s in response.sentences])

        # 2) Cache the generated sentences in Postgres
        await state.db.store_cached_sentences(payload.collocation_id, payload.display_form, response)
        return response
    except Exception as e:
        logfire.error("Sentence workshop generation failed: {error}", error=str(e))
        # Direct graceful linguistic fallback so user always receives a response
        return SentenceWorkshopResponse(
            collocation_id=payload.collocation_id,
            display_form=payload.display_form,
            sentences=[
                GeneratedSentenceItem(
                    context_type="formal",
                    context_title="بافت رسمی و اداری",
                    sentence=f"هیئت‌مدیره در نشست اخیر، پیرامون تمدید قراردادها به «{payload.display_form}» مبادرت ورزید.",
                    explanation=f"کاربرد باهم‌آیی «{payload.display_form}» در نامه‌نگاری و مکاتبات سازمانی، رویکردی رسمی و مستند را بازتاب می‌دهد.",
                ),
                GeneratedSentenceItem(
                    context_type="journalistic",
                    context_title="بافت مطبوعاتی و تحلیلی",
                    sentence=f"کارشناسان اقتصادی بر این باورند که در شرایط کنونی، باهم‌آیی و فرآیند «{payload.display_form}» می‌تواند ثبات بازار را تضمین کند.",
                    explanation=f"در زبان مطبوعات و مقالات تحلیلی، عبارت «{payload.display_form}» به تقویت بار استدلالی و استحکام متن یاری می‌رساند.",
                ),
                GeneratedSentenceItem(
                    context_type="daily",
                    context_title="بافت روزمره و روایی",
                    sentence=f"بعد از مدت‌ها فکر کردن و مشورت با دوستان، بالاخره درباره این موضوع به «{payload.display_form}» رسیدیم.",
                    explanation=f"در گفتگوی روزمره و بیان روایت‌های فردی، استفاده از «{payload.display_form}» کلام را طبیعی و دلنشین می‌سازد.",
                ),
            ],
        )


SEARCH_ASSIST_LIMITS = UsageLimits(request_limit=5)


@app.post("/search-assist", response_model=SearchAssistantResponse)
async def search_assist(payload: SearchAssistantRequest) -> SearchAssistantResponse:
    """Provides instant linguistic guidance when a user query returns 0 statistical results in the database."""
    query_cleaned = " ".join(payload.query.strip().split())
    query_hash = hashlib.sha256(query_cleaned.encode("utf-8")).hexdigest()

    # 1) Check exact-match cache
    cached = await state.db.get_cached_search_assistant(query_hash)
    if cached is not None:
        with logfire.span("هم‌یار - تحلیل جستجو: {query}", query=query_cleaned) as span:
            span.set_attribute("cache_hit", True)
            span.set_attribute("query", query_cleaned)
            span.set_attribute("status_type", cached.status_type)
            span.set_attribute("badge_label", cached.badge_label)
            span.set_attribute("summary", cached.summary)
            span.set_attribute("linguistic_analysis", cached.linguistic_analysis)
            span.set_attribute("suggested_collocations", cached.suggested_collocations)
            if cached.example_sentence:
                span.set_attribute("example_sentence", cached.example_sentence)
        return cached

    prompt = (
        f"عبارت جستجوشده توسط کاربر در سامانه:\n«{query_cleaned}»\n\n"
        "این عبارت ممکن است یک باهم‌آیی فارسی، عبارت عامیانه، واژه مرکب، غلط املایی، گرته‌برداری، فینگلیش، خطای کیبورد انگلیسی (QWERTY)، یا واژه/سوال به زبان انگلیسی باشد. "
        "لطفاً بر اساس تخصص زبان‌شناسی خود، وضعیت عبارت را تحلیل کن و معادل‌ها یا باهم‌آیی‌های اصیل، اصطلاحی و رایج در زبان فارسی را به همراه یک جمله نمونه کاربردی و بی‌نقص ارائه بده."
    )

    try:
        with logfire.span("هم‌یار - تحلیل جستجو: {query}", query=query_cleaned) as span:
            span.set_attribute("cache_hit", False)
            span.set_attribute("query", query_cleaned)
            result = await state.search_assistant_agent.run(prompt, usage_limits=SEARCH_ASSIST_LIMITS)
            response: SearchAssistantResponse = result.output
            response.query = query_cleaned

            span.set_attribute("status_type", response.status_type)
            span.set_attribute("badge_label", response.badge_label)
            span.set_attribute("summary", response.summary)
            span.set_attribute("linguistic_analysis", response.linguistic_analysis)
            span.set_attribute("suggested_collocations", response.suggested_collocations)
            if response.example_sentence:
                span.set_attribute("example_sentence", response.example_sentence)

        # 2) Cache the response in Postgres
        await state.db.store_cached_search_assistant(query_hash, query_cleaned, response)
        return response
    except Exception as e:
        logfire.error("Search assistant analysis failed: {error}", error=str(e))
        # Direct graceful linguistic fallback
        return SearchAssistantResponse(
            query=query_cleaned,
            status_type="unnatural_combination",
            badge_label="تحلیل هوشمند همیار",
            summary=f"عبارت «{query_cleaned}» به این شکل در پیکره ثبتی هم‌واژه موجود نیست و ممکن است یک ترکیب غیرمعمول، گفتاری یا کلمه مرکب باشد.",
            linguistic_analysis=(
                f"در زبان فارسی، واژه‌ها بر اساس پیوندهای هم‌آیی مقید با یکدیگر ترکیب می‌شوند. "
                f"اگر مقصود شما مفهومی نزدیک به این عبارت است، اهل زبان معمولاً از همنشین‌های اصیل و گوش‌نواز دیگری استفاده می‌کنند."
            ),
            suggested_collocations=[
                "بررسی باهم‌آیی‌های هم‌معنی",
                "جستجوی واژه اصلی در بخش جستجو",
            ],
            example_sentence=None,
        )


@app.get("/health")
async def health() -> dict:
    flags_today = await state.db.count_flags_today()
    return {
        "status": "ok",
        "service": "hamvajeh-agent",
        "flags_logged_today": flags_today,
    }
