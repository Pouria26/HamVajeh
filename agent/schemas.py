"""Pydantic models shared across the database layer, the agent, and the API."""

from typing import Literal

from pydantic import BaseModel, Field

class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "model"] = Field(..., description="Role of the sender")
    content: str = Field(..., min_length=1, description="Message content")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Current user question or input")
    history: list[ChatMessage] = Field(default_factory=list, description="Prior conversational turns")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="Persian educational response from the assistant")
    suggested_followups: list[str] = Field(
        default_factory=list,
        description="2-3 relevant follow-up questions to deepen understanding",
    )


def score_to_frequency_level(score_100: float | None) -> str | None:
    """Maps a 0-100 minmax score to a qualitative Persian frequency category.
    Scores strictly below 15.0 are excluded/hidden (returns None).
    """
    if score_100 is None or score_100 < 15.0:
        return None
    if score_100 >= 60.0:
        return "پرتکرار"
    if score_100 >= 40.0:
        return "متداول"
    return "عادی"


class CollocationSearchResult(BaseModel):
    id: int
    display_form: str
    pos_pattern: str | None = None
    minmax_score: float | None = Field(
        default=None,
        description="Normalized score (0-100). Do NOT display raw numbers to user.",
    )
    frequency_level: str | None = Field(
        default=None,
        description="Qualitative frequency level: پرتکرار (>=60), متداول (>=40), عادی (>=15). None if <15.",
    )
    sample_sentence: str | None = Field(
        default=None,
        description="Authentic sentence example from the corpus.",
    )


class CollocationDetailResult(BaseModel):
    id: int
    display_form: str
    word1: str
    word2: str | None = None
    pos_pattern: str | None = None
    minmax_score: float | None = Field(
        default=None,
        description="Normalized score (0-100). Do NOT display raw numbers to user.",
    )
    frequency_level: str | None = Field(
        default=None,
        description="Qualitative frequency level: پرتکرار (>=60), متداول (>=40), عادی (>=15). None if <15.",
    )
    status: str | None = None
    correction_note: str | None = None
    examples: list[str] = Field(default_factory=list)


class ExerciseEvidence(BaseModel):
    """Everything fetched from Postgres for one 'why is this wrong' request."""

    collocation_id: int
    example_id: int
    word1: str
    word2: str | None
    status: Literal["valid", "corrected"]
    correction_note: str | None
    pmi: float | None
    logdice: float | None
    minmax_score: float | None
    blank_sentence: str
    database_correct_answer: str
    user_selected_answer: str

    @property
    def collocation_display(self) -> str:
        return f"{self.word1} {self.word2 or ''}".strip()

    @property
    def selected_word(self) -> str:
        return self.user_selected_answer

    @property
    def correct_word(self) -> str:
        return self.database_correct_answer


class ExerciseJudgment(BaseModel):
    """Structured output of the exercise-explanation agent."""

    agrees_with_database: Literal["agree", "disagree", "uncertain"] = Field(
        description="Whether the model's own independent linguistic judgment matches the database's label."
    )
    confidence: Literal["low", "medium", "high"]
    linguistic_reasoning: str = Field(
        description="Internal Persian reasoning, not shown to the end user."
    )
    user_facing_answer: str = Field(
        description=(
            "Final Persian answer shown to the user. Must talk about the "
            "language itself, never about 'the database', 'status field', "
            "or internal statistics."
        )
    )
    flag_for_review: bool = Field(
        description="True if this dataset item should be queued for human review."
    )

    @property
    def verdict(self) -> str:
        return self.agrees_with_database


class AuditEvidence(BaseModel):
    """Everything needed to audit one collocation pair with no sentence context."""

    collocation_id: int
    word1: str
    word2: str | None
    pos_pattern: str | None
    status: Literal["valid", "corrected"]
    correction_note: str | None
    pmi: float | None
    logdice: float | None
    minmax_score: float | None


class AuditJudgment(BaseModel):
    """Structured output of the dataset-quality-audit agent."""

    is_fixed_collocation: Literal["yes", "no", "borderline"]
    confidence: Literal["low", "medium", "high"]
    linguistic_reasoning: str
    flag_for_review: bool


class GeneratedSentenceItem(BaseModel):
    """A sentence generated in a specific linguistic register."""

    context_type: Literal["formal", "journalistic", "daily"] = Field(
        description="Register/context: formal (اداری/رسمی), journalistic (مطبوعاتی/تحلیلی), daily (روزمره/داستانی)"
    )
    context_title: str = Field(
        description="User-facing Persian title of the context (e.g., 'بافت رسمی / اداری')"
    )
    sentence: str = Field(
        description="Realistic Persian sentence naturally incorporating the target collocation"
    )
    explanation: str = Field(
        description="Concise Persian explanation highlighting how the collocation functions in this register"
    )


class SentenceWorkshopRequest(BaseModel):
    collocation_id: int = Field(..., description="ID of the collocation")
    display_form: str = Field(..., min_length=1, description="Persian display form of the collocation")


class SentenceWorkshopResponse(BaseModel):
    collocation_id: int
    display_form: str
    sentences: list[GeneratedSentenceItem] = Field(
        default_factory=list,
        description="Exactly 3 sentences representing formal, journalistic, and daily contexts",
    )


class SearchAssistantRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User search query that yielded 0 statistical results")


class SearchAssistantResponse(BaseModel):
    query: str
    status_type: Literal[
        "unnatural_combination",
        "compound_word",
        "colloquial",
        "valid_not_in_db",
        "free_combination",
    ] = Field(
        description="Categorization of the queried phrase"
    )
    badge_label: str = Field(
        description="Short Persian badge label (e.g., 'ترکیب نامأنوس', 'اسم مرکب', 'اصطلاح محاوره‌ای', 'باهم‌آیی اصیل خارج از پایگاه')"
    )
    summary: str = Field(
        description="One or two prominent Persian sentences explaining the core takeaway"
    )
    linguistic_analysis: str = Field(
        description="In-depth Persian educational explanation of syntax, semantics, and native speaker conventions"
    )
    suggested_collocations: list[str] = Field(
        default_factory=list,
        description="List of authentic Persian collocations or natural alternatives"
    )
    example_sentence: str | None = Field(
        default=None,
        description="An authentic example sentence showing correct usage of the suggested alternative"
    )

