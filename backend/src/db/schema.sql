-- HamVajeh database schema (PostgreSQL)
-- Simplified 3-table design for the university project scope.
-- Auth / progress / SRS tables are intentionally left out for now (future work).

DROP TABLE IF EXISTS exercise_options CASCADE;
DROP TABLE IF EXISTS examples CASCADE;
DROP TABLE IF EXISTS collocations CASCADE;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE collocations (
    id              SERIAL PRIMARY KEY,
    pair_id         INTEGER NOT NULL UNIQUE,  -- traceability back to the source CSV row

    word1           TEXT NOT NULL,
    word2           TEXT,                      -- nullable: null when word1 already holds the merged form (e.g. "گفت‌وگو")
    display_form    TEXT NOT NULL,             -- final UI-facing form
    pos_pattern     TEXT,

    status          TEXT NOT NULL,             -- 'valid' | 'corrected'  ('invalid' rows are never imported)
    correction_note TEXT,                      -- provenance only, not shown in the main UI

    pmi             DOUBLE PRECISION,
    t_score         DOUBLE PRECISION,
    llr             DOUBLE PRECISION,
    logdice         DOUBLE PRECISION,
    combined_score  DOUBLE PRECISION,
    minmax_score    DOUBLE PRECISION,

    needs_review    BOOLEAN NOT NULL DEFAULT false, -- admin-set flag: "I edited this but I'm still not fully sure"

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collocations_word1 ON collocations(word1);
CREATE INDEX idx_collocations_minmax ON collocations(minmax_score DESC);

-- Fuzzy / substring search support (used by the search endpoint)
CREATE INDEX idx_collocations_display_trgm ON collocations USING gin (display_form gin_trgm_ops);

CREATE TABLE examples (
    id              SERIAL PRIMARY KEY,
    collocation_id  INTEGER NOT NULL REFERENCES collocations(id) ON DELETE CASCADE,

    sentence        TEXT NOT NULL,
    blank_sentence  TEXT,
    target_phrase   TEXT,           -- exact text that was blanked out (== correct answer)
    example_order   SMALLINT NOT NULL,

    UNIQUE (collocation_id, example_order)
);

CREATE INDEX idx_examples_collocation ON examples(collocation_id);

CREATE TABLE exercise_options (
    id              SERIAL PRIMARY KEY,
    example_id      INTEGER NOT NULL REFERENCES examples(id) ON DELETE CASCADE,

    option_text     TEXT NOT NULL,
    option_order    SMALLINT NOT NULL,
    is_correct      BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_options_example ON exercise_options(example_id);
