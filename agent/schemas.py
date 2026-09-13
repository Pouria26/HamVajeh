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
