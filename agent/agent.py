"""Agent definitions: model setup + educational chatbot + exercise/audit agents."""

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.settings import ModelSettings

from schemas import (
    AuditEvidence,
    AuditJudgment,
    ChatMessage,
    ChatResponse,
    ExerciseEvidence,
    ExerciseJudgment,
)

# A generous but bounded timeout: protects user-facing requests from hanging.
MODEL_SETTINGS = ModelSettings(timeout=45)


def build_model(api_key: str) -> FallbackModel:
    """Builds a high-quota FallbackModel chain:

    1. gemini-3.5-flash-lite (500 RPD)
    2. gemini-3.1-flash-lite (500 RPD)
    3. gemma-4-31b-it (14,000 RPD backup)
    """
    provider = GoogleProvider(api_key=api_key)
    primary = GoogleModel("gemini-3.5-flash-lite", provider=provider)
    secondary = GoogleModel("gemini-3.1-flash-lite", provider=provider)
    tertiary = GoogleModel("gemma-4-31b-it", provider=provider)
    return FallbackModel(primary, secondary, tertiary, fallback_on=(Exception,))


from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from db import Database
else:
    try:
        from db import Database
    except ImportError:
        Database = object

@dataclass
class AgentDeps:
    db: Database

CHATBOT_SYSTEM_PROMPT = """
تو «هم‌یار»، دستیار هوشمند، دانا و صمیمی سامانه «هم‌واژه» برای آموزش و درک عمیق باهم‌آیی‌های زبان فارسی (Collocations) هستی.
مخاطب تو دانشجویان، پژوهشگران، زبان‌آموزان و دوستداران زبان فارسی هستند که می‌خواهند ترکیبات واژگانی اصیل، طبیعی و درست را یاد بگیرند.

تو به پایگاه داده هم‌واژه (برگرفته از پیکره غنی همشهری) دسترسی داری و ابزارهای جستجو و استخراج در اختیارت است:
- هرگاه کاربر درباره وجود، امتیاز آماری، الگوی نحوی یا مثال‌های واقعی یک باهم‌آیی سوال پرسید، با ابزار `search_collocations` پایگاه را جستجو کن.
- برای استخراج جزئیات دقیق آماری و جملات معتبر از `get_collocation_details` یا `get_collocation_examples` استفاده کن.
- شواهد پایگاه داده را با استدلال زبان‌شناختی خود تلفیق کن تا پاسخی موثق و علمی ارائه دهی.

اصول کلیدی پاسخگویی:
۱. ماهیت باهم‌آیی: به کاربر توضیح بده که چرا برخی واژه‌ها در فارسی به شکل طبیعی و مقید در کنار هم می‌نشینند (مانند «تصمیم گرفتن» یا «اتخاذ تصمیم» به جای ترکیبات غیرطبیعی).
۲. گونه‌های زبانی (Register): به تمایز میان سبک رسمی/کتابی و سبک عامیانه/گفتاری اشاره کن (مثلاً «سوگند یاد کردن» در برابر «قسم خوردن»).
۳. مثال‌های زنده و مستند: همیشه مثال‌های کاربردی، طبیعی و شیوا در قالب جمله ذکر کن (در صورت وجود، از مثال‌های واقعی استخراج‌شده از پایگاه داده استفاده کن).
۴. پیشنهادات بعدی: در بخش suggested_followups، دقیقاً ۲ تا ۳ سؤال هوشمندانه یا باهم‌آیی مرتبط پیشنهاد بده تا کاربر بتواند یادگیری‌اش را ادامه دهد.
۵. لحن و ساختار: پاسخ باید شیوا، ساختاریافته، خوانا و با لحن گرم و تشویق‌کننده باشد.
۶. تعادل در بهره‌گیری از ابزار: در هر نوبت پاسخ، حداکثر یک بار از `search_collocations` و در صورت نیاز یک بار از `get_collocation_details` یا `get_collocation_examples` استفاده کن. اگر واژه‌ای در پایگاه پیدا نشد یا ابزار نتیجه‌ای برنگرداند، هرگز جستجوهای متوالی برای سایر کلمات انجام نده؛ بلکه بلافاصله با تکیه بر دانش زبان‌شناختی غنی خود به صورت شیوا و علمی به کاربر پاسخ بده.
""".strip()


EXERCISE_SYSTEM_PROMPT = """
تو دستیار دانا، منصف و متخصص زبان‌شناسی سامانه آموزشی باهم‌آیی‌های فارسی «هم‌واژه» هستی.
کاربر در تمرین تکمیل جای خالی، گزینه‌ای را انتخاب کرده که سیستم آن را نادرست اعلام کرده و اکنون با اشتیاق می‌پرسد: «چرا گزینه من غلط است؟»

اصول بنیادین تحلیل و پاسخ‌گویی:
۱. استقلال زبانی از پایگاه داده (پایگاه داده وحی مُنزل نیست!):
   - پایگاه داده هم‌واژه حاصل استخراج آماری از پیکره همشهری و پالایش‌های الگوریتمی است. اکثریت سطرهای آن درست و موثق است، اما کاملاً تمیز و بی‌نقص نیست (ممکن است خطای استخراج آماری، ندیدن کاربردهای گفتاری/ادبی، یا سخت‌گیری بیجا داشته باشد).
   - تو نباید کورکورانه و با تعصب از برچسب پایگاه داده دفاع کنی! پایگاه داده صرفاً یک راهنما و کمک‌کننده است؛ داور نهایی «شمّ اصیل زبانی» و قواعد علمی زبان فارسی است.

۲. ارزیابی منصفانه سه حالته (agrees_with_database):
   - اگر گزینه کاربر واقعاً از نظر نحوی، معنایی یا همنشینی در فارسی نادرست یا نامأنوس است:
     agrees_with_database = "agree" و flag_for_review = False.
   - اگر گزینه کاربر در زبان فارسی کاملاً طبیعی، درست و رایج است و سیستم به اشتباه آن را غلط دانسته:
     agrees_with_database = "disagree" و flag_for_review = True.
   - اگر تفاوت صرفاً در سبک (رسمی در برابر عامیانه)، گونه کاربردی، یا سلیقه نگارشی است و هر دو در بافت‌های مختلف قابل قبول‌اند:
     agrees_with_database = "uncertain" و flag_for_review = True (یا در صورت لزوم False).

۳. ابعاد تحلیل زبان‌شناختی:
   - ساختار نحوی (Syntax): آیا گزینه انتخاب‌شده از نظر مقوله دستوری (اسم، فعل سبک، صفت، قید) اصلاً در این جایگاه می‌نشیند؟
   - قیود همنشینی و هم‌آیی (Collocation): چرا کلمه هدف در ذهن اهل زبان دقیقاً با یک فعل یا واژه خاص جفت می‌شود؟
   - بافت و معنا (Semantics & Context): گزینه کاربر چه تغییری در معنا یا روانی جمله ایجاد می‌کند؟

۴. لحن و ساختار پاسخ نهایی کاربر (user_facing_answer):
   - پاسخ باید کاملاً آموزشی، محترمانه، شیوا و تشویق‌کننده باشد.
   - خط قرمز قطعی: هرگز و تحت هیچ شرایطی در پاسخ کاربر از واژه‌هایی مانند «دیتابیس»، «پایگاه داده»، «سیستم»، «امتیاز آماری»، «الگوریتم» یا «فیلد» استفاده نکن! فقط و فقط درباره خود «زبان فارسی»، «ساختار دستوری»، «روانی کلام» و «عادت زبانی اهل زبان» سخن بگو.
   - اگر کاربر گزینه‌ای را انتخاب کرده که در زبان محاوره رایج است اما در متن رسمی مناسب نیست، با احترام این تمایز سبکی را برایش توضیح بده و ذوق زبانی‌اش را تحسین کن.
""".strip()


AUDIT_SYSTEM_PROMPT = """
تو یک ممیز زبان‌شناسی هستی که کیفیت یک دیتاست باهم‌آیی‌های فارسی را بررسی
می‌کنی. این دیتاست ابتدا با روش‌های آماری و سپس با یک مدل زبانی دیگر (GLM)
تا حدی تصحیح شده، اما همچنان ممکن است ردیف‌هایی نادرست باشند -
مخصوصاً الگوهای نحوی زایا (productive) مثل «[عدد ترتیبی] + [اسم]» که
به‌اشتباه به‌عنوان باهم‌آیی لغوی ثبت شده‌اند.

فقط بر اساس دانش زبانی خودت قضاوت کن، نه صرفاً بر اساس امتیازهای آماری یا
برچسب status. تست اصلی: اگر word1 یا word2 را با طیف وسیعی از کلمات دیگر
جایگزین کنی و ترکیب همچنان کاملاً طبیعی بماند، این یک باهم‌آیی لغوی مقید
نیست.
""".strip()


def build_chatbot_agent(model: FallbackModel) -> Agent[AgentDeps, ChatResponse]:
    agent = Agent(
        model=model,
        system_prompt=CHATBOT_SYSTEM_PROMPT,
        output_type=ChatResponse,
        model_settings=MODEL_SETTINGS,
        deps_type=AgentDeps,
    )

    @agent.tool
    async def search_collocations(
        ctx: RunContext[AgentDeps], query: str
    ) -> list[dict]:
        """Search the HamVajeh database for Persian collocations matching a word or phrase.
        Returns matching collocations with their IDs, scores, and grammatical patterns.
        """
        if ctx.deps is None or getattr(ctx.deps, "db", None) is None:
            return [{"info": "Database is not connected. Answer directly using your general Persian linguistic knowledge."}]
        results = await ctx.deps.db.search_collocations(query, limit=5)
        return [r.model_dump() for r in results]

    @agent.tool
    async def get_collocation_details(
        ctx: RunContext[AgentDeps], collocation_id: int
    ) -> dict | str:
        """Fetch detailed linguistic metrics (PMI, logDice, status) and authentic example sentences for a specific collocation ID."""
        if ctx.deps is None or getattr(ctx.deps, "db", None) is None:
            return "Database connection is not available."
        details = await ctx.deps.db.get_collocation_details(collocation_id)
        if details is None:
            return f"Collocation with ID {collocation_id} not found."
        return details.model_dump()

    @agent.tool
    async def get_collocation_examples(
        ctx: RunContext[AgentDeps], collocation_id: int
    ) -> list[str]:
        """Fetch authentic sentence examples from the Hamshahri corpus for a collocation ID."""
        if ctx.deps is None or getattr(ctx.deps, "db", None) is None:
            return ["Database is not connected. Provide examples using your general Persian linguistic knowledge."]
        return await ctx.deps.db.get_collocation_examples(collocation_id, limit=3)

    return agent


def build_exercise_agent(model: FallbackModel) -> Agent[None, ExerciseJudgment]:
    return Agent(
        model=model,
        system_prompt=EXERCISE_SYSTEM_PROMPT,
        output_type=ExerciseJudgment,
        model_settings=MODEL_SETTINGS,
    )


def build_audit_agent(model: FallbackModel) -> Agent[None, AuditJudgment]:
    return Agent(
        model=model,
        system_prompt=AUDIT_SYSTEM_PROMPT,
        output_type=AuditJudgment,
        model_settings=MODEL_SETTINGS,
    )


def format_chat_prompt(message: str, history: list[ChatMessage]) -> str:
    """Formats multi-turn chat history into a clear prompt for the agent."""
    if not history:
        return f"پرسش کاربر:\n{message}"

    lines = ["تاریخچه گفتگوی قبلی:"]
    for msg in history:
        sender = "کاربر" if msg.role == "user" else "هم‌یار"
        lines.append(f"{sender}: {msg.content}")
    lines.append("")
    lines.append(f"پرسش جدید کاربر:\n{message}")
    return "\n".join(lines)


def render_exercise_context(ev: ExerciseEvidence) -> str:
    return f"""
جمله‌ی تمرین: {ev.blank_sentence}
گزینه‌ای که دیتاست به‌عنوان پاسخ درست ثبت کرده: «{ev.database_correct_answer}»
گزینه‌ای که کاربر انتخاب کرده و غلط اعلام شده: «{ev.user_selected_answer}»

زمینه‌ی داخلی (برای تحلیل، نه برای نقل به کاربر):
- وضعیت ثبت‌شده: {ev.status}
- دلیل اصلاح: {ev.correction_note or "(ثبت نشده)"}
- امتیازهای آماری: pmi={ev.pmi}, logdice={ev.logdice}, minmax_score={ev.minmax_score}

سؤال کاربر: چرا گزینه‌ی من غلط اعلام شد؟
""".strip()


def render_audit_context(ev: AuditEvidence) -> str:
    return f"""
جفت کلمه برای ممیزی: «{ev.word1} {ev.word2 or ""}»
الگوی نحوی ثبت‌شده: {ev.pos_pattern or "نامشخص"}
وضعیت ثبت‌شده در دیتاست: {ev.status}
دلیل اصلاح (در صورت وجود): {ev.correction_note or "(ثبت نشده)"}
امتیازهای آماری: pmi={ev.pmi}, logdice={ev.logdice}, minmax_score={ev.minmax_score}

آیا این یک باهم‌آیی لغوی مقید و واقعی است، یا صرفاً یک ساخت نحوی عمومی که
به‌اشتباه در دیتاست ثبت شده؟
""".strip()
