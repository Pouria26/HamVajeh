-- Run this once against an existing database that was created before the
-- "report a problem" feature was added. Safe to re-run.
--
-- Usage (adjust connection details as needed):
--   psql "$DATABASE_URL" -f src/db/migrations/002_add_reports_table.sql

CREATE TABLE IF NOT EXISTS reports (
    id              SERIAL PRIMARY KEY,
    collocation_id  INTEGER NOT NULL REFERENCES collocations(id) ON DELETE CASCADE,
    example_id      INTEGER REFERENCES examples(id) ON DELETE CASCADE,
    reason          TEXT NOT NULL,
    comment         TEXT,
    status          TEXT NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_collocation ON reports(collocation_id);
