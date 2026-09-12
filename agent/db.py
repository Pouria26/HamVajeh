"""
Postgres access layer, built on asyncpg against the existing `collocations` /
`examples` / `exercise_options` schema (unchanged - no migration needed there).

Two small new tables are created by `ensure_agent_tables()` on startup:

    agent_cache  - exact-match cache keyed by (example_id, selected_option_id),
                   so repeated identical questions never re-call Gemini and
                   never burn daily quota twice for the same case.
    agent_flags  - append-only log of items the agent disagreed with the
                   dataset on, for later human review.

Nothing here talks to Gemini - this module is purely responsible for reading
exercise context and reading/writing the two agent-specific tables.
"""

import asyncpg

from schemas import AuditEvidence, ExerciseEvidence, ExerciseJudgment

CREATE_AGENT_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS agent_cache (
    example_id          INTEGER NOT NULL,
    selected_option_id  INTEGER NOT NULL,
    result_json         JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (example_id, selected_option_id)
);

CREATE TABLE IF NOT EXISTS agent_flags (
    id              SERIAL PRIMARY KEY,
    collocation_id  INTEGER NOT NULL,
    example_id      INTEGER,
    reasoning       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""

FETCH_EXERCISE_EVIDENCE_SQL = """
SELECT
    c.id            AS collocation_id,
    c.word1,
    c.word2,
    c.status,
    c.correction_note,
    c.pmi,
    c.logdice,
    c.minmax_score,
    e.id            AS example_id,
    COALESCE(e.blank_sentence, e.sentence) AS blank_sentence,
    correct_opt.option_text  AS database_correct_answer,
    selected_opt.option_text AS user_selected_answer
FROM examples e
JOIN collocations c
    ON c.id = e.collocation_id
JOIN exercise_options correct_opt
    ON correct_opt.example_id = e.id AND correct_opt.is_correct = true
JOIN exercise_options selected_opt
    ON selected_opt.id = $2
WHERE e.id = $1;
"""

FETCH_AUDIT_EVIDENCE_SQL = """
SELECT
    id AS collocation_id,
    word1,
    word2,
    pos_pattern,
    status,
    correction_note,
    pmi,
    logdice,
    minmax_score
FROM collocations
WHERE id = $1;
"""


class Database:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self.pool = pool

    @classmethod
    async def connect(cls, dsn: str) -> "Database":
        pool = await asyncpg.create_pool(dsn=dsn, min_size=1, max_size=10)
        return cls(pool)

    async def close(self) -> None:
        await self.pool.close()

    async def ensure_agent_tables(self) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute(CREATE_AGENT_TABLES_SQL)

    async def fetch_exercise_evidence(
        self, example_id: int, selected_option_id: int
    ) -> ExerciseEvidence | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                FETCH_EXERCISE_EVIDENCE_SQL, example_id, selected_option_id
            )
        if row is None:
            return None
        return ExerciseEvidence(**dict(row))

    async def fetch_audit_evidence(self, collocation_id: int) -> AuditEvidence | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(FETCH_AUDIT_EVIDENCE_SQL, collocation_id)
        if row is None:
            return None
        return AuditEvidence(**dict(row))

    async def get_cached_judgment(
        self, example_id: int, selected_option_id: int
    ) -> ExerciseJudgment | None:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT result_json FROM agent_cache WHERE example_id = $1 AND selected_option_id = $2",
                example_id,
                selected_option_id,
            )
        if row is None:
            return None
        return ExerciseJudgment.model_validate_json(row["result_json"])

    async def store_cached_judgment(
        self, example_id: int, selected_option_id: int, judgment: ExerciseJudgment
    ) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO agent_cache (example_id, selected_option_id, result_json)
                VALUES ($1, $2, $3::jsonb)
                ON CONFLICT (example_id, selected_option_id) DO NOTHING
                """,
                example_id,
                selected_option_id,
                judgment.model_dump_json(),
            )

    async def record_flag(
        self, collocation_id: int, example_id: int | None, reasoning: str
    ) -> None:
        async with self.pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO agent_flags (collocation_id, example_id, reasoning) VALUES ($1, $2, $3)",
                collocation_id,
                example_id,
                reasoning,
            )

    async def count_flags_today(self) -> int:
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT count(*) AS n FROM agent_flags WHERE created_at >= date_trunc('day', now())"
            )
        return int(row["n"])
