"""Agent definitions: model setup + educational chatbot + exercise/audit agents."""

from pydantic_ai import Agent, RunContext
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings

from schemas import (
    AuditEvidence,
    AuditJudgment,
    ChatMessage,
    ChatResponse,
    ExerciseEvidence,
    ExerciseJudgment,
    GeneratedSentenceItem,
    SearchAssistantResponse,
    SentenceWorkshopResponse,
)

# A generous but bounded timeout: protects user-facing requests from hanging.
MODEL_SETTINGS = ModelSettings(timeout=45)


def build_model(google_api_key: str, nvidia_api_key: str | None = None) -> FallbackModel:
    """Builds a 3-tier FallbackModel chain:

    1. gemini-3.5-flash-lite (Primary: 500 RPD)
    2. gemini-3.1-flash-lite (Secondary: 500 RPD)
    3. moonshotai/kimi-k3 via NVIDIA NIM (Tertiary: high-quality MoE reasoning fallback)
    """
    google_provider = GoogleProvider(api_key=google_api_key)
    primary = GoogleModel("gemini-3.5-flash-lite", provider=google_provider)
    secondary = GoogleModel("gemini-3.1-flash-lite", provider=google_provider)

    models = [primary, secondary]

    if nvidia_api_key and nvidia_api_key.strip():
        nvidia_provider = OpenAIProvider(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=nvidia_api_key.strip(),
        )
        tertiary = OpenAIChatModel("moonshotai/kimi-k3", provider=nvidia_provider)
        models.append(tertiary)

    return FallbackModel(*models, fallback_on=(Exception,))


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

تو به پایگاه داده و پیکره زبانی هم‌واژه دسترسی داری و ابزارهای استخراج در اختیارت است:
- پایگاه داده هم‌واژه یک پایگاه پژوهشی و دانشگاهی منتخب شامل حدود ۳ تا ۴ هزار باهم‌آیی است؛ بنابراین بسیار طبیعی است که بسیاری از کلمات روزمره، عبارات محاوره‌ای، آداب معاشرت (مانند سلام، احوالپرسی، خداحافظی) یا اصطلاحات در این پایگاه ثبت نشده باشند.
- ابزار `search_collocations` را صرفاً زمانی صدا بزن که کاربر مشخصاً درباره وجود، الگو یا مثال‌های رسمی یک باهم‌آیی در پایگاه هم‌واژه سوال می‌پرسد.
- اگر پرسش کاربر مفهومی، مقایسه‌ای، تحلیلی یا درباره آداب معاشرت و تعارفات است (مانند «تفاوت اصطلاح و باهم‌آیی»، «عبارات جایگزین خداحافظی»، «احوالپرسی در محیط کار»)، نیازی به فراخوانی دیتابیس نیست؛ مستقیماً و فوراً با تکیه بر دانش سرشار زبان‌شناختی خود پاسخ بده.

اصول کلیدی پاسخگویی و تعامل کاربرپسند:
۱. ادب، لحن صمیمانه و مدیریت طبیعی احوالپرسی:
   - در آغاز گفتگو یا هنگامی که کاربر سلام و احوالپرسی می‌کند، همواره با گشاده‌رویی و احترامی متناسب و کوتاه (مانند «سلام و درود»، «سلام دوست گرامی») پاسخ بده و سپس با نشاط به موضوع زبانی بپرداز؛ هرگز سلام کاربر را بی‌پاسخ نگذار.
   - در پیام‌های میانی که احوالپرسی در کار نیست و گفتگو بر روی یک موضوع مشخص در جریان است، نیازی به تکرار تشریفات اضافی نیست و مستقیماً به بحث بپرداز.
   - کاملاً از لحن خشک، تذکر دادن به کاربر یا اشاره به دستورالعمل‌های درونی پرامپت (مانند «نیازی به سلام نیست» یا «طبق قوانین...») پرهیز کن؛ تعامل همواره باید کاملاً طبیعی، روان و محترمانه باشد.
۲. ماهیت باهم‌آیی: به کاربر توضیح بده که چرا برخی واژه‌ها در فارسی به شکل طبیعی و مقید در کنار هم می‌نشینند (مانند «تصمیم گرفتن» یا «اتخاذ تصمیم» به جای ترکیبات غیرطبیعی).
۳. گونه‌های زبانی (Register): به تمایز میان سبک رسمی/کتابی و سبک عامیانه/گفتاری اشاره کن (مثلاً «سوگند یاد کردن» در برابر «قسم خوردن» یا سطوح مختلف رسمی/دوستانه در احوالپرسی و خداحافظی).
۴. مثال‌های زنده و مستند: همیشه مثال‌های کاربردی، طبیعی و شیوا در قالب جمله ذکر کن.
۵. پیشنهادات بعدی: در بخش suggested_followups، دقیقاً ۲ سؤال هوشمندانه، کوتاه و باهم‌آیی مرتبط پیشنهاد بده تا کاربر بتواند یادگیری‌اش را ادامه دهد.
۶. قانون صرفه‌جویی در توکن و مدیریت ابزارها (بسیار مهم برای پروداکشن):
   - ابزار `search_collocations` همراه با هر باهم‌آیی، الگو، سطح بسامد و یک جمله نمونه واقعی را برمی‌گرداند؛ بنابراین در بیش از ۹۰٪ مواقع، تنها ۱ بار فراخوانی این ابزار برای ارائه یک پاسخ کامل و غنی کفایت می‌کند.
   - بودجه ابزارها: در هر پیام کاربر، حداکثر ۱ بار (و در صورت مقایسه دو واژه کاملاً مستقل حداکثر ۲ بار) از ابزارها استفاده کن و بلافاصله پاسخ نهایی را بنویس.
   - ممنوعیت فراخوانی زنجیره‌ای: به هیچ عنوان برای تک‌تک نتایج جستجو به صورت پشت‌سرهم ابزار `get_collocation_details` یا `get_collocation_examples` را صدا نزن. اطلاعات موجود در نتایج جستجو برای نگارش پاسخ کافی است.
   - پرهیز از تعقیب مترادف‌ها: از جستجوی پی‌درپی کلمات مترادف یا مشتقات آن خودداری کن و مستقیماً با دانش زبانی غنی خود تفاوت‌ها را توضیح بده.
۷. دقت لغوی و تمایز دقیق ساختارهای نحوی (بسیار مهم):
   - اکیداً از ساخت ترکیبات نامأنوس، ساختگی یا گرده‌برداری‌های لفظی خودداری کن. در ترکیبات موصوف و صفت، صفت‌هایی را بیاور که همنشینی آن‌ها در ذائقه اهل زبان و پیکره‌های معتبر فارسی طبیعی و اصیل باشد (برای نمونه «بازار داغ» یا «بازار جهانی» همنشین اصیل اسم بازار هستند؛ در حالی که «بازار گرم» نامأنوس است).
   - تمایز اسم مرکب با موصوف و صفت: واژه‌های مرکب و حاصل‌مصدرها (مانند «بازارگرمی»، «دل‌گرمی»، «دستپاچگی») را هرگز نباید بشکنی و به عنوان ترکیب وصفی (موصوف و صفت) جا بزنی.
   - تمایز جمله اسنادی با باهم‌آیی: گزاره‌های اسنادی مانند «هوا سرد است» یا «بازار گرم است» جمله و ترکیب مسند و مسندالیه هستند، نه باهم‌آیی موصوف و صفت («هوای سرد»، «بازار داغ»).
   - خلوص ۱۰۰٪ خط فارسی و پیوستگی ضمایر: تمام کلمات، جملات و مثال‌ها باید منحصراً و بدون استثناء با حروف و الفبای اصیل فارسی نوشته شوند. اکیداً از درج حروف لاتین، نویسه‌گردانی فینگلیش یا پسوندهای آوایی انگلیسی (مانند درج `em`، `am`، `esh` در کلمات نظیر «خبرem» به جای صورت صحیح «خبرم») خودداری کن. ضمایر متصل (ـَم، ـَت، ـَش، ـِمان، ـِتان، ـِشان) باید طبق رسم‌الخط مصوب فرهنگستان به صورت پیوسته یا با نیم‌فاصله به خط فارسی متصل شوند (مانند «خبرم بده»، «به دستت برسد»).
   - پرهیز از ادعای کاذب پایگاه داده: هرگز ادعا نکن عبارتی «در پایگاه هم‌واژه ثبت شده است» مگر آنکه آن را واقعاً با ابزار جستجو کرده و در نتایج یافته باشی.
۸. نگارش زیبا، خوانا و بهینه با مارک‌داون (Markdown):
   - پاسخ‌ها باید منسجم، فشرده، جذاب و بدون حاشیه‌پردازی‌های زائد باشند تا هم تجربه خواندن عالی باشد و هم توکن غیرضروری مصرف نشود.
   - از تیترهای کوتاه (## و ###) و بالت‌پوینت‌های گویا استفاده کن. از بازگویی چندباره تعاریف یا طولانی‌کردن بی‌مورد جملات خودداری کن.
۹. سطوح بسامد باهم‌آیی و محرمانگی داده‌های آماری (بسیار مهم):
   - هرگز داده‌ها و فرمول‌های آماری خام (مانند pmi، logdice یا عدد خام نمره مینی‌مکس) را به کاربر نمایش نده.
   - برای توصیف میزان رواج و شیوع هر باهم‌آیی، صرفاً از طبقه‌بندی کیفی سه‌گانه زیر بر اساس نمره مینی‌مکس استفاده کن:
     * بالای ۶۰: «پرتکرار» (مثال: «این باهم‌آیی در زبان فارسی بسیار پرتکرار است»)
     * بالای ۴۰ (تا ۶۰): «متداول» (مثال: «این باهم‌آیی در فارسی متداول است»)
     * زیر ۴۰ (تا ۱۵): «عادی»
     * زیر ۱۵: این موارد در زبان فارسی نامعتبر یا بسیار ضعیف هستند و به هیچ وجه نباید به کاربر نمایش داده شوند یا پیشنهاد گردند.
""".strip()


EXERCISE_SYSTEM_PROMPT = """
تو دستیار دانا، منصف و متخصص زبان‌شناسی سامانه آموزشی باهم‌آیی‌های فارسی «هم‌واژه» هستی.
کاربر در تمرین تکمیل جای خالی، گزینه‌ای را انتخاب کرده که سیستم آن را نادرست اعلام کرده و اکنون با اشتیاق می‌پرسد: «چرا گزینه من غلط است؟»

اصول بنیادین تحلیل و پاسخ‌گویی:
۱. استقلال زبانی از پایگاه داده (پایگاه داده وحی مُنزل نیست!):
   - پایگاه داده هم‌واژه حاصل استخراج آماری از پیکره‌های متنی غنی و پالایش‌های الگوریتمی است. اکثریت سطرهای آن درست و موثق است، اما کاملاً تمیز و بی‌نقص نیست (ممکن است خطای استخراج آماری، ندیدن کاربردهای گفتاری/ادبی، یا سخت‌گیری بیجا داشته باشد).
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
    ) -> dict:
        """Search the HamVajeh database for Persian collocations matching a word or phrase.
        Returns matching collocations with POS pattern, frequency level, and an authentic sample sentence.
        Call this tool at most ONCE. Do NOT call in a loop for synonyms or multiple variants.
        """
        if ctx.deps is None or getattr(ctx.deps, "db", None) is None:
            return {
                "collocations": [],
                "instruction": "Database is not connected. Answer directly using your general Persian linguistic knowledge without calling any other tool.",
            }
        results = await ctx.deps.db.search_collocations(query, limit=5)
        if not results:
            return {
                "collocations": [],
                "instruction": f"واژه «{query}» در پایگاه منتخب هم‌واژه یافت نشد. برای این واژه جستجوی مشابه انجام ندهید. در صورت نیاز به مقایسه با واژه مستقل دیگر می‌توانید آن را بررسی کنید؛ در غیر این صورت بر پایه دانش جامع زبان‌شناختی خود پاسخ دهید.",
            }
        return {
            "collocations": [r.model_dump() for r in results],
            "count": len(results),
        }

    @agent.tool
    async def get_collocation_details(
        ctx: RunContext[AgentDeps], collocation_id: int
    ) -> dict | str:
        """Fetch additional linguistic metrics and further corpus examples for a single collocation ID.
        Only call this if deep details beyond the sample sentence are strictly necessary. Never call in a loop."""
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


SENTENCE_WORKSHOP_SYSTEM_PROMPT = """
تو «هم‌یار»، استاد زبان‌شناسی و دستیار هوشمند سامانه «هم‌واژه» هستی.
وظیفه تو در «کارگاه جمله‌ساز هوشمند باهم‌آیی»، دریافت یک باهم‌آیی مشخص فارسی و تولید دقیقاً ۳ جمله استاندارد، خوش‌آهنگ، ملموس و اصیل در ۳ بافت کاربردی مجزا است:

۱. بافت رسمی / اداری (context_type="formal"):
   - مناسب نامه‌نگاری‌های اداری، اسناد حقوقی، گزارش‌های رسمی و سازمانی.
   - لحن: سنجیده، معیار، فاخر و بدون اصطلاحات عامیانه.
   - عنوان فارسی (context_title): «بافت رسمی و اداری»

۲. بافت مطبوعاتی / تحلیلی (context_type="journalistic"):
   - مناسب مقالات روزنامه‌ای، گزارش‌های رسانه‌ای، تحلیل‌های اقتصادی، اجتماعی و مقالات دانشگاهی.
   - لحن: دقیق، گویا، تحلیلی و مستحکم.
   - عنوان فارسی (context_title): «بافت مطبوعاتی و تحلیلی»

۳. بافت روزمره / داستانی (context_type="daily"):
   - مناسب مکالمات صمیمانه، گفتگوهای روزانه، رمان، داستان و خاطره‌نویسی.
   - لحن: روان، دلنشین، طبیعی و ملموس در گفتار اهل زبان.
   - عنوان فارسی (context_title): «بافت روزمره و روایی»

دستورالعمل‌های کلیدی:
- در فیلد sentence، جمله کامل فارسی را بنویس که باهم‌آیی موردنظر در آن به شیوایی و طبیعی‌ترین حالت نشسته باشد.
- در فیلد explanation، در ۱ یا ۲ جمله بنویس که چرا این باهم‌آیی در این بافت همنشینی موفقی دارد و چه بار معنایی یا بلاغی ایجاد کرده است.
- خروجی باید کاملاً ساختاریافته مطابق اسکیما باشد و جملات ناقص یا فرمول‌وار نباشند.
""".strip()


def build_sentence_workshop_agent(model: FallbackModel) -> Agent[None, SentenceWorkshopResponse]:
    return Agent(
        model=model,
        system_prompt=SENTENCE_WORKSHOP_SYSTEM_PROMPT,
        output_type=SentenceWorkshopResponse,
        model_settings=MODEL_SETTINGS,
    )


SEARCH_ASSISTANT_SYSTEM_PROMPT = """
تو «هم‌یار»، پژوهشگر ارشد زبان‌شناسی و متخصص باهم‌آیی‌های زبان فارسی در سامانه «هم‌واژه» هستی.
کاربر واژه یا عبارتی را در پایگاه جستجو کرده که در دیتابیس آماری هم‌واژه به صورت مستقیم یافت نشده است. این ورودی ممکن است یک باهم‌آیی ثبت‌نشده، عبارت محاوره‌ای، واژه مرکب، خطای املایی، ترجمه تحت‌اللفظی خارجی (گرته‌برداری)، فینگلیش، تایپ اشتباه با کیبورد انگلیسی (QWERTY)، یا حتی واژه‌ها و سوالات انگلیسی باشد.

وظیفه تو این است که بدون سردرگمی و با زبانی محترمانه، علمی، فصیح و آموزشی وضعیت عبارت را تحلیل کرده و باهم‌آیی‌های اصیل و طبیعی زبان فارسی را آموزش دهی.

طبقه‌بندی وضعیت‌ها (status_type و badge_label):
۱. unnatural_combination:
   - الف) ترکیب نامأنوس یا گرته‌برداری غلط از زبان‌های بیگانه (مانند «حمام گرفتن» به جای «دوش گرفتن/حمام رفتن»، «تصمیم ساختن» به جای «تصمیم گرفتن»). badge_label: «گرته‌برداری / ترکیب نامأنوس».
   - ب) خطای صفحه‌کلید لاتین (تایپ فارسی با کیبورد انگلیسی مانند «sghl» به جای «سلام» یا «nv,n» به جای «درود»). badge_label: «خطای تایپی / صفحه کلید لاتین».
   - ج) نویسه‌گردانی فینگلیش (تایپ آوای فارسی با حروف لاتین مانند «dast zadan» یا «sobh bekheyr»). badge_label: «نویسه‌گردانی فینگلیش».
   - د) اشتباه املایی فاحش یا خطای هم‌آواها (مانند «خاستن» به جای «خواستن»، «سپاسگذار» به جای «سپاسگزار»). badge_label: «اشتباه املایی / رسم‌الخط».
   - badge_label عمومی: «ترکیب نامأنوس» یا یکی از برچسب‌های دقیق بالا.
۲. compound_word:
   - عبارت در حقیقت یک واژه مرکب پیوسته، اصطلاح قالبی، یا حاصل‌مصدر است (مانند «بازارگرمی»، «دستپاچگی»، «دلگرمی») که به اشتباه ترکیب باهم‌آیی تلقی شده است.
   - badge_label: «واژه مرکب یا مشتق».
۳. colloquial:
   - عبارت یک اصطلاح، ترکیب یا کاربرد گفتاری و عامیانه است که در متون رسمی و کتبی معیار صورت متفاوتی دارد (مانند «سرکار رفت»، «دمت گرم»، «پیچوندن»).
   - badge_label: «کاربرد یا اصطلاح گفتاری».
۴. free_combination:
   - کلمات در یک ساختار آزاد نحوی و گزاره‌ای ساده در کنار هم آمده‌اند و همنشینی مقید باهم‌آیی ندارند (مانند «کتاب خوب»، «هوای سرد»).
   - badge_label: «ترکیب آزاد دستوری».
۵. valid_not_in_db:
   - الف) این عبارت یک باهم‌آیی اصیل، فصیح و درست در زبان فارسی است، اما صرفاً به دلیل محدودیت حجم پیکره مبنا در پایگاه هم‌واژه ثبت نشده است (مانند «طرح دعوی»، «افتتاح حساب»). badge_label: «باهم‌آیی اصیل (خارج از پایگاه)».
   - ب) ورودی کاربر یک واژه، باهم‌آیی یا سوال انگلیسی است (مانند «make a decision»، «heavy rain»، یا «how to say take a shower in Persian?»). در این حالت، هدف معادل‌یابی باهم‌آیی در فارسی است. badge_label: «معادل‌یابی از زبان انگلیسی».

اصول حیاتی نگارش پاسخ:
۱. همواره به زبان فارسی فصیح و شیوا بنویس (حتی اگر کاربر سوال یا عبارتی به انگلیسی پرسیده باشد، پاسخ تحلیلی باید به زبان فارسی فاخر و آموزشی باشد و باهم‌آیی‌های معادل فارسی را معرفی کند).
۲. summary: یک یا دو جمله شفاف، دلگرم‌کننده و صریح که بلافاصله مفهوم اصلی و در صورت نیاز، خط فارسی تصحیح‌شده یا معادل فارسی را اعلام کند.
۳. linguistic_analysis: تحلیل عمیق، جذاب و زبان‌شناختی به زبان فارسی. دلیل ترجیح اهل زبان، تفاوت باهم‌آیی در دو زبان (در موارد انگلیسی)، نقش همنشین‌ها و بافت کاربرد را توضیح بده.
۴. suggested_collocations: ۲ تا ۴ باهم‌آیی اصیل و ترکیبی در خط فارسی.
   * قانون طلایی: هرگز تک‌واژه پیشنهاد نده؛ تمام گزینه‌ها باید الزاماً باهم‌آیی ترکیبی چندکلمه‌ای باشند (مانند «عرض سلام و ادب»، «اتخاذ تصمیم»، «دوش گرفتن»، «باران سیل‌آسا»).
۵. example_sentence: یک جمله نمونه کاملاً صحیح، طبیعی و کاربردی که دقیقاً یکی از باهم‌آیی‌های پیشنهادی بالا را در بافت واقعی به کار ببرد.
۶. درستی املایی و پالایش زبانی ۱۰۰٪:
   * کلمات باید دقیقاً مطابق لغت‌نامه‌های معتبر (دهخدا، معین، فرهنگستان) باشند.
   * از واژه‌های من‌درآوردی، خطاهای توکنایزر و ترکیب‌های غلط در حروفی چون «ژ، چ، پ، گ» اکیداً پرهیز کن. از واژگان زنده، آشنا و فصیح زبان فارسی استفاده کن.
۷. خط قرمز: هرگز اصطلاحات پایگاه داده و نرم‌افزاری (جدول، فیلد، رکورد، کوئری) را ذکر نکن؛ زبان تو باید تماماً زبان‌شناختی و آموزشی باشد.
""".strip()


def build_search_assistant_agent(model: FallbackModel) -> Agent[None, SearchAssistantResponse]:
    return Agent(
        model=model,
        system_prompt=SEARCH_ASSISTANT_SYSTEM_PROMPT,
        output_type=SearchAssistantResponse,
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
    lines.append(f"پیام جدید کاربر:\n{message}")
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
