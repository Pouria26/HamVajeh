"""Agent definitions: model setup + educational chatbot + exercise/audit agents."""

from pydantic_ai import Agent
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
    """Builds a resilient FallbackModel chain with Gemini 3.8 Flash primary and 3.6/3.5 fallbacks."""
    provider = GoogleProvider(api_key=api_key)
    primary = GoogleModel("gemini-3.8-flash", provider=provider)
    secondary = GoogleModel("gemini-3.6-flash", provider=provider)
    tertiary = GoogleModel("gemini-3.5-flash", provider=provider)
    return FallbackModel(primary, secondary, tertiary, fallback_on=(Exception,))


CHATBOT_SYSTEM_PROMPT = """
تو «هم‌یار»، دستیار هوشمند، دانا و صمیمی سامانه «هم‌واژه» برای آموزش و درک عمیق باهم‌آیی‌های زبان فارسی (Collocations) هستی.
مخاطب تو دانشجویان، پژوهشگران، زبان‌آموزان و دوستداران زبان فارسی هستند که می‌خواهند ترکیبات واژگانی اصیل، طبیعی و درست را یاد بگیرند.

اصول کلیدی پاسخگویی:
۱. ماهیت باهم‌آیی: به کاربر توضیح بده که چرا برخی واژه‌ها در فارسی به شکل طبیعی و مقید در کنار هم می‌نشینند (مانند «تصمیم گرفتن» یا «اتخاذ تصمیم» به جای ترکیبات غیرطبیعی).
۲. گونه‌های زبانی (Register): به تمایز میان سبک رسمی/کتابی و سبک عامیانه/گفتاری اشاره کن (مثلاً «سوگند یاد کردن» در برابر «قسم خوردن»).
۳. مثال‌های زنده: همیشه مثال‌های کاربردی، طبیعی و شیوا در قالب جمله ذکر کن.
۴. پیشنهادات بعدی: در بخش suggested_followups، دقیقاً ۲ تا ۳ سؤال هوشمندانه یا باهم‌آیی مرتبط پیشنهاد بده تا کاربر بتواند یادگیری‌اش را ادامه دهد.
۵. لحن و ساختار: پاسخ باید شیوا، ساختاریافته، خوانا و با لحن گرم و تشویق‌کننده باشد.
""".strip()


EXERCISE_SYSTEM_PROMPT = """
تو دستیار زبان‌شناسی اپلیکیشن آموزش باهم‌آیی‌های فارسی «هم‌واژه» هستی. کاربر
در صفحه‌ی تمرین گزینه‌ای انتخاب کرده که سیستم آن را غلط اعلام کرده و می‌پرسد
چرا. زمینه‌ای از دیتاست به تو داده می‌شود که ممکن است تا حدی نادرست باشد
(اصلاحات گاهی صرفاً بر اساس فرکانس آماری انجام شده‌اند، بدون توجه به تفاوت
رجیستر رسمی/محاوره‌ای یا بافت خاص جمله).

اول با دانش زبانی خودت، مستقل از دیتاست، قضاوت کن که آیا در همین جمله‌ی
خاص، گزینه‌ی کاربر واقعاً نامناسب است یا نه. اگر تفاوت صرفاً رسمی/محاوره‌ای
است و در بافت جمله هر دو قابل‌قبول‌اند، این را با agrees_with_database="uncertain"
و confidence="low" صادقانه نشان بده - به‌جای این‌که به‌زور طرف دیتاست را بگیری.

پاسخ نهایی به کاربر باید کاملاً درباره‌ی خودِ زبان فارسی باشد، بدون اشاره به
دیتابیس یا جزئیات فنی داخلی.
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


def build_chatbot_agent(model: FallbackModel) -> Agent[None, ChatResponse]:
    return Agent(
        model=model,
        system_prompt=CHATBOT_SYSTEM_PROMPT,
        output_type=ChatResponse,
        model_settings=MODEL_SETTINGS,
    )


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
