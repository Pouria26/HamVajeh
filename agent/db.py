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

from schemas import (
    AuditEvidence,
    ChatResponse,
    CollocationDetailResult,
    CollocationSearchResult,
    ExerciseEvidence,
    ExerciseJudgment,
    SearchAssistantResponse,
    SentenceWorkshopResponse,
    score_to_frequency_level,
)

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

CREATE TABLE IF NOT EXISTS chat_cache (
    query_hash      TEXT PRIMARY KEY,
    user_message    TEXT NOT NULL,
    response_json   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sentence_workshop_cache (
    collocation_id  INTEGER PRIMARY KEY,
    display_form    TEXT NOT NULL,
    response_json   JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS search_assistant_cache (
    query_hash      TEXT PRIMARY KEY,
    query_text      TEXT NOT NULL,
    response_json   JSONB NOT NULL,
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
                ON CONFLICT (example_id, selected_option_id) DO UPDATE
                SET result_json = EXCLUDED.result_json,
                    created_at = now();
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

    async def search_collocations(
        self, query: str, limit: int = 5
    ) -> list[CollocationSearchResult]:
        """Searches collocations matching query in display_form, word1, or word2.
        Excludes low-quality entries with minmax_score < 0.15 (<15).
        """
        sql = """
        SELECT c.id, c.display_form, c.pos_pattern, c.minmax_score,
               (SELECT e.sentence FROM examples e WHERE e.collocation_id = c.id LIMIT 1) AS sample_sentence
        FROM collocations c
        WHERE (c.display_form ILIKE '%' || $1 || '%'
           OR c.word1 ILIKE '%' || $1 || '%'
           OR c.word2 ILIKE '%' || $1 || '%')
          AND c.minmax_score >= 0.15
        ORDER BY
           (c.display_form ILIKE $1 || '%') DESC,
           c.minmax_score DESC NULLS LAST
        LIMIT $2;
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, query.strip(), limit)
        results: list[CollocationSearchResult] = []
        for r in rows:
            raw_score = r["minmax_score"]
            score_100 = round(raw_score * 100, 1) if raw_score is not None else None
            level = score_to_frequency_level(score_100)
            results.append(
                CollocationSearchResult(
                    id=r["id"],
                    display_form=r["display_form"],
                    pos_pattern=r["pos_pattern"],
                    minmax_score=score_100,
                    frequency_level=level,
                    sample_sentence=r["sample_sentence"],
                )
            )
        return results

    async def get_collocation_details(
        self, collocation_id: int
    ) -> CollocationDetailResult | None:
        """Retrieves full metadata and corpus sentences for a specific collocation ID."""
        sql_collocation = """
        SELECT id, display_form, word1, word2, pos_pattern, minmax_score, status, correction_note
        FROM collocations
        WHERE id = $1;
        """
        sql_examples = """
        SELECT sentence
        FROM examples
        WHERE collocation_id = $1
        ORDER BY example_order ASC
        LIMIT 5;
        """
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(sql_collocation, collocation_id)
            if row is None:
                return None
            ex_rows = await conn.fetch(sql_examples, collocation_id)

        raw_score = row["minmax_score"]
        score_100 = round(raw_score * 100, 1) if raw_score is not None else None
        level = score_to_frequency_level(score_100)
        return CollocationDetailResult(
            id=row["id"],
            display_form=row["display_form"],
            word1=row["word1"],
            word2=row["word2"],
            pos_pattern=row["pos_pattern"],
            minmax_score=score_100,
            frequency_level=level,
            status=row["status"],
            correction_note=row["correction_note"],
            examples=[r["sentence"] for r in ex_rows],
        )

    async def get_collocation_examples(
        self, collocation_id: int, limit: int = 3
    ) -> list[str]:
        """Fetches authentic sentence examples from the Hamshahri corpus for a collocation."""
        sql = """
        SELECT sentence
        FROM examples
        WHERE collocation_id = $1
        ORDER BY example_order ASC
        LIMIT $2;
        """
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(sql, collocation_id, limit)
        return [r["sentence"] for r in rows]

    async def get_cached_chat(self, query_hash: str) -> ChatResponse | None:
        """Retrieves a cached chat response by query hash to protect LLM quota."""
        sql = "SELECT response_json FROM chat_cache WHERE query_hash = $1;"
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(sql, query_hash)
        if row is None:
            return None
        return ChatResponse.model_validate_json(row["response_json"])

    async def store_cached_chat(
        self, query_hash: str, user_message: str, response: ChatResponse
    ) -> None:
        """Stores a chat response in the exact-match cache."""
        sql = """
        INSERT INTO chat_cache (query_hash, user_message, response_json)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (query_hash) DO UPDATE
        SET response_json = EXCLUDED.response_json,
            user_message = EXCLUDED.user_message,
            created_at = now();
        """
        async with self.pool.acquire() as conn:
            await conn.execute(sql, query_hash, user_message, response.model_dump_json())

    async def get_cached_sentences(
        self, collocation_id: int
    ) -> SentenceWorkshopResponse | None:
        """Retrieves cached generated sentences for a collocation ID."""
        sql = "SELECT response_json FROM sentence_workshop_cache WHERE collocation_id = $1;"
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(sql, collocation_id)
        if row is None:
            return None
        return SentenceWorkshopResponse.model_validate_json(row["response_json"])

    async def store_cached_sentences(
        self, collocation_id: int, display_form: str, response: SentenceWorkshopResponse
    ) -> None:
        """Stores generated sentences in sentence_workshop_cache."""
        sql = """
        INSERT INTO sentence_workshop_cache (collocation_id, display_form, response_json)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (collocation_id) DO UPDATE
        SET response_json = EXCLUDED.response_json,
            display_form = EXCLUDED.display_form,
            created_at = now();
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                sql, collocation_id, display_form, response.model_dump_json()
            )

    async def get_cached_search_assistant(
        self, query_hash: str
    ) -> SearchAssistantResponse | None:
        """Retrieves cached search assistant analysis by query hash."""
        sql = "SELECT response_json FROM search_assistant_cache WHERE query_hash = $1;"
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(sql, query_hash)
        if row is None:
            return None
        return SearchAssistantResponse.model_validate_json(row["response_json"])

    async def store_cached_search_assistant(
        self, query_hash: str, query_text: str, response: SearchAssistantResponse
    ) -> None:
        """Stores search assistant analysis in search_assistant_cache."""
        sql = """
        INSERT INTO search_assistant_cache (query_hash, query_text, response_json)
        VALUES ($1, $2, $3::jsonb)
        ON CONFLICT (query_hash) DO UPDATE
        SET response_json = EXCLUDED.response_json,
            query_text = EXCLUDED.query_text,
            created_at = now();
        """
        async with self.pool.acquire() as conn:
            await conn.execute(
                sql, query_hash, query_text, response.model_dump_json()
            )

    async def purge_stale_caches(self, max_age_days: int = 30) -> dict[str, int]:
        """Delete cache entries older than *max_age_days*.

        Returns a mapping of table name → number of rows deleted so callers
        (e.g. an admin endpoint or a scheduled task) can log the results.
        """
        tables = [
            "chat_cache",
            "agent_cache",
            "sentence_workshop_cache",
            "search_assistant_cache",
        ]
        results: dict[str, int] = {}
        async with self.pool.acquire() as conn:
            for table in tables:
                tag = await conn.execute(
                    f"DELETE FROM {table} WHERE created_at < now() - interval '{max_age_days} days'"
                )
                # asyncpg returns e.g. "DELETE 42"
                results[table] = int(tag.split()[-1])
        return results
