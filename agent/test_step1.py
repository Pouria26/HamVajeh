import asyncio
import sys
import logfire
from agent import build_chatbot_agent, build_model, format_chat_prompt
from schemas import ChatMessage, ChatRequest, ChatResponse
from settings import get_settings

settings = get_settings()
logfire.configure(
    service_name="hamvajeh-agent-test",
    token=settings.logfire_token,
    send_to_logfire="if-token-present",
)
logfire.instrument_pydantic_ai()


async def test_step1():
    print("=== Testing Step 1: Persian Collocation Chatbot ===")
    settings = get_settings()

    print("1. Testing Model & Agent Construction...")
    model = build_model(settings.google_api_key)
    chatbot = build_chatbot_agent(model)
    print("   Agent built successfully.")

    print("\n2. Testing Single-Turn Question...")
    user_query = "با کلمه‌ی «تصمیم» چه فعل‌های سبکی هم‌آیی می‌سازند؟"
    prompt = format_chat_prompt(user_query, [])
    result = await chatbot.run(prompt)
    response: ChatResponse = result.output

    print("   Output validation: ChatResponse instance ->", isinstance(response, ChatResponse))
    assert isinstance(response, ChatResponse)
    assert len(response.reply) > 20
    assert len(response.suggested_followups) > 0
    print(f"   Reply sample (first 100 chars):\n   {response.reply[:100]}...")
    print(f"   Suggested follow-ups count: {len(response.suggested_followups)}")
    for i, follow_up in enumerate(response.suggested_followups, 1):
        print(f"     {i}. {follow_up}")

    print("\n3. Testing Multi-Turn Conversation...")
    history = [
        ChatMessage(role="user", content=user_query),
        ChatMessage(role="assistant", content=response.reply),
    ]
    second_query = "کدام یک در نامه‌نگاری‌های رسمی و اداری متداول‌تر است؟"
    prompt2 = format_chat_prompt(second_query, history)
    result2 = await chatbot.run(prompt2)
    response2: ChatResponse = result2.output

    assert isinstance(response2, ChatResponse)
    assert len(response2.reply) > 20
    print(f"   Second turn reply sample:\n   {response2.reply[:100]}...")

    print("\n=== All Step 1 Tests PASSED Successfully! ===")


if __name__ == "__main__":
    # Ensure UTF-8 output on Windows console
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(test_step1())
