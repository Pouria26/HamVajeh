"""Unified Test Suite for HamVajeh AI Agent Service.

Consolidates tests for all development phases into a single, structured runner.

Usage:
    python test_cases.py          # Run all available test suites (Steps 1, 2, & 3)
    python test_cases.py 1        # Run only Step 1 tests (Foundational Chatbot)
    python test_cases.py 2        # Run only Step 2 tests (Database Tools & Caching)
    python test_cases.py 3        # Run only Step 3 tests (Quiz Error Analysis & Auditing)
    python test_cases.py --help   # Display CLI usage instructions
"""

import argparse
import asyncio
import hashlib
import sys

import logfire
from pydantic_ai.usage import UsageLimits

from agent import (
    AgentDeps,
    build_chatbot_agent,
    build_exercise_agent,
    build_model,
    format_chat_prompt,
    render_exercise_context,
)
from db import Database
from schemas import ChatMessage, ChatResponse, ExerciseEvidence, ExerciseJudgment
from settings import get_settings

settings = get_settings()
logfire.configure(
    service_name="hamvajeh-agent-tests",
    token=settings.logfire_token,
    send_to_logfire="if-token-present",
)
logfire.instrument_pydantic_ai()


async def test_step1() -> bool:
    """Step 1: Foundational Chatbot Service (Multi-turn conversations & Structured Output)."""
    print("\n" + "=" * 60)
    print(">>> RUNNING SUITE 1: Foundational Chatbot (Step 1)")
    print("=" * 60)

    settings = get_settings()

    print("1.1 Testing Model & Agent Construction...")
    db = await Database.connect(settings.database_url)
    model = build_model(settings.google_api_key, settings.nvidia_api_key)
    chatbot = build_chatbot_agent(model)
    deps = AgentDeps(db=db)
    print("    Model chain initialized with high-quota fallback.")

    print("\n1.2 Testing Single-Turn Linguistic Query...")
    user_query = "با کلمه‌ی «تصمیم» چه فعل‌های سبکی هم‌آیی می‌سازند؟"
    prompt = format_chat_prompt(user_query, [])

    result = await chatbot.run(prompt, deps=deps, usage_limits=UsageLimits(request_limit=8))
    response: ChatResponse = result.output
    usage = result.usage

    print(f"    - Output is ChatResponse: {isinstance(response, ChatResponse)}")
    print(f"    - API Requests: {usage.requests}, Tool Calls: {usage.tool_calls}, Tokens: {usage.total_tokens}")
    assert isinstance(response, ChatResponse), "Expected ChatResponse instance"
    assert len(response.reply) > 20, "Reply too short"
    assert len(response.suggested_followups) > 0, "Expected at least 1 follow-up suggestion"
    print(f"    - Reply sample: {response.reply[:120].strip()}...")
    print(f"    - Follow-ups ({len(response.suggested_followups)}):")
    for i, follow_up in enumerate(response.suggested_followups, 1):
        print(f"      {i}. {follow_up}")

    print("\n1.3 Testing Multi-Turn Conversational Memory...")
    history = [
        ChatMessage(role="user", content=user_query),
        ChatMessage(role="assistant", content=response.reply),
    ]
    second_query = "کدام یک در نامه‌نگاری‌های رسمی و اداری متداول‌تر است؟"
    prompt2 = format_chat_prompt(second_query, history)
    result2 = await chatbot.run(prompt2, deps=deps, usage_limits=UsageLimits(request_limit=8))
    response2: ChatResponse = result2.output

    assert isinstance(response2, ChatResponse), "Expected ChatResponse in turn 2"
    assert len(response2.reply) > 20, "Turn 2 reply too short"
    print(f"    - Second turn reply sample: {response2.reply[:120].strip()}...")

    await db.close()
    print("\n>>> [PASS] Suite 1: Foundational Chatbot PASSED Successfully!")
    return True


async def test_step2() -> bool:
    """Step 2: Grounded Database Tool Calling & Chat Caching."""
    print("\n" + "=" * 60)
    print(">>> RUNNING SUITE 2: Grounded Database Tools & Caching (Step 2)")
    print("=" * 60)

    settings = get_settings()

    print("2.1 Connecting to PostgreSQL and verifying agent tables...")
    db = await Database.connect(settings.database_url)
    print("    Connected to database and verified agent_cache/agent_flags/chat_cache.")

    print("\n2.2 Testing Direct Database Functions...")
    search_results = await db.search_collocations("تصمیم", limit=5)
    assert len(search_results) > 0, "No collocations found for 'تصمیم'"
    top = search_results[0]
    print(f"    - Found {len(search_results)} collocations. Top: ID={top.id}, Display='{top.display_form}'")

    details = await db.get_collocation_details(top.id)
    assert details is not None, f"Could not retrieve details for ID {top.id}"
    print(f"    - Details: Score={details.minmax_score}, Frequency={details.frequency_level}, Examples={len(details.examples)}")

    examples = await db.get_collocation_examples(top.id, limit=3)
    assert len(examples) > 0, "Could not retrieve examples"
    print(f"    - Sample authentic sentence: '{examples[0][:60]}...'")

    print("\n2.3 Testing Pydantic AI Agent with Live Database Tools...")
    model = build_model(settings.google_api_key, settings.nvidia_api_key)
    agent = build_chatbot_agent(model)
    deps = AgentDeps(db=db)

    query = "آیا ترکیب «تصمیم گرفتن» در پایگاه داده هم‌واژه وجود دارد؟ نمره آماری و یک نمونه جمله واقعی از پیکره برای آن ذکر کن."
    prompt = format_chat_prompt(query, [])

    print("    Running agent with tool access (search_collocations, get_collocation_details)...")
    run_result = await agent.run(prompt, deps=deps, usage_limits=UsageLimits(request_limit=8))
    response: ChatResponse = run_result.output
    usage = run_result.usage

    print("    Agent response received:")
    print(f"    - Type is ChatResponse: {isinstance(response, ChatResponse)}")
    print(f"    - Gemini API requests made: {usage.requests}")
    print(f"    - Tool calls executed: {usage.tool_calls}")
    print(f"    - Total tokens used: {usage.total_tokens}")
    assert isinstance(response, ChatResponse), "Expected ChatResponse"
    assert len(response.reply) > 50, "Reply too short"
    print(f"    - Reply sample: {response.reply[:150].strip()}...")
    print(f"    - Follow-up suggestions ({len(response.suggested_followups)}):")
    for i, s in enumerate(response.suggested_followups, 1):
        print(f"      {i}. {s}")

    print("\n2.4 Testing Exact-Match Chat Cache (UPSERT & Retrieval)...")
    normalized = " ".join(query.strip().split())
    query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    await db.store_cached_chat(query_hash, query, response)
    print("    Stored response in PostgreSQL chat_cache.")

    cached_hit = await db.get_cached_chat(query_hash)
    assert cached_hit is not None, "Cache lookup failed"
    assert cached_hit.reply == response.reply, "Cached reply mismatch"
    print("    Cache hit verified successfully! (Instant retrieval, 0 Gemini tokens)")

    await db.close()
    print("\n>>> [PASS] Suite 2: Grounded Database Tools & Caching PASSED Successfully!")
    return True


async def test_step3() -> bool:
    """Step 3: Quiz Error Analysis & Dataset Discrepancy Auditing."""
    print("\n" + "=" * 60)
    print(">>> RUNNING SUITE 3: Quiz Error Analysis & Auditing (Step 3)")
    print("=" * 60)

    settings = get_settings()

    print("3.1 Connecting to PostgreSQL...")
    db = await Database.connect(settings.database_url)

    # Example 1: 'او برای پاسخ به سؤالات معلم مورد تشویق ___________.'
    # Correct: 'قرار گرفت' (opt 1), Distractor: 'بودجه جاری' (opt 2)
    example_id = 1
    selected_option_id = 2

    print(f"\n3.2 Fetching Real Exercise Evidence (example_id={example_id}, option_id={selected_option_id})...")
    evidence = await db.fetch_exercise_evidence(example_id, selected_option_id)
    assert evidence is not None, "Failed to fetch exercise evidence from database"
    print(f"    - Blank Sentence: '{evidence.blank_sentence}'")
    print(f"    - System Correct Answer: '{evidence.database_correct_answer}'")
    print(f"    - User Selected Answer: '{evidence.user_selected_answer}'")
    print(f"    - Collocation ID: {evidence.collocation_id}, Status: {evidence.status}")

    print("\n3.3 Testing Exercise Explanation Agent (Independent Linguistic Judgment)...")
    model = build_model(settings.google_api_key, settings.nvidia_api_key)
    exercise_agent = build_exercise_agent(model)

    context = render_exercise_context(evidence)
    run_result = await exercise_agent.run(context, usage_limits=UsageLimits(request_limit=8))
    judgment: ExerciseJudgment = run_result.output
    usage = run_result.usage

    print("    Agent judgment received:")
    print(f"    - Type is ExerciseJudgment: {isinstance(judgment, ExerciseJudgment)}")
    print(f"    - Agrees with Database: '{judgment.agrees_with_database}'")
    print(f"    - Confidence: '{judgment.confidence}'")
    print(f"    - Flag for Review: {judgment.flag_for_review}")
    print(f"    - API Requests: {usage.requests}, Tokens: {usage.total_tokens}")
    print(f"    - Internal Reasoning: {judgment.linguistic_reasoning[:120].strip()}...")
    print(f"    - User-Facing Explanation:\n      {judgment.user_facing_answer}")

    assert isinstance(judgment, ExerciseJudgment), "Output must be ExerciseJudgment"
    assert judgment.agrees_with_database in ("agree", "disagree", "uncertain")
    assert len(judgment.user_facing_answer) > 40, "Explanation too brief"
    # Ensure no database jargon was leaked to the user
    for forbidden in ["دیتابیس", "فیلد", "الگوریتم", "status", "pmi", "logdice"]:
        assert forbidden not in judgment.user_facing_answer.lower(), f"Forbidden technical term '{forbidden}' in user_facing_answer"

    print("\n3.4 Testing Exercise Judgment Caching (agent_cache)...")
    await db.store_cached_judgment(example_id, selected_option_id, judgment)
    print("    Stored judgment in agent_cache table.")

    cached_judgment = await db.get_cached_judgment(example_id, selected_option_id)
    assert cached_judgment is not None, "Failed to retrieve judgment from cache"
    assert cached_judgment.user_facing_answer == judgment.user_facing_answer, "Cached explanation mismatch"
    print("    Cache hit verified successfully! (Instant retrieval, 0 Gemini tokens)")

    print("\n3.5 Testing Audit Flag Recording (agent_flags)...")
    flags_before = await db.count_flags_today()
    test_reasoning = "بررسی ممیزی خودکار: گزینه انتخابی کاربر از نظر کاربرد گفتاری نیازمند بررسی ممیز انسانی است."
    await db.record_flag(evidence.collocation_id, evidence.example_id, test_reasoning)
    flags_after = await db.count_flags_today()
    assert flags_after == flags_before + 1, f"Flag count mismatch: expected {flags_before + 1}, got {flags_after}"
    print(f"    Flag recorded successfully! (Today's count: {flags_after})")

    await db.close()
    print("\n>>> [PASS] Suite 3: Quiz Error Analysis & Auditing PASSED Successfully!")
    return True


async def main() -> None:
    parser = argparse.ArgumentParser(
        description="Unified test suite for HamVajeh AI Agent service."
    )
    parser.add_argument(
        "step",
        type=int,
        nargs="?",
        default=0,
        help="Optional step number to run (1 for Chatbot, 2 for DB Tools, 3 for Quiz Explain, 0 for all).",
    )
    args = parser.parse_args()

    target_step = args.step

    if target_step == 1:
        await test_step1()
    elif target_step == 2:
        await test_step2()
    elif target_step == 3:
        await test_step3()
    elif target_step == 0:
        print("Running ALL available test suites (Steps 1, 2, and 3)...")
        await test_step1()
        await test_step2()
        await test_step3()
        print("\n" + "=" * 60)
        print("ALL TEST SUITES (Steps 1, 2 & 3) COMPLETED SUCCESSFULLY!")
        print("=" * 60)
    else:
        print(f"Unknown step {target_step}. Available steps: 1, 2, 3 (or 0 for all).")
        sys.exit(1)


if __name__ == "__main__":
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        asyncio.run(main())
    finally:
        try:
            logfire.force_flush()
        except Exception:
            pass
