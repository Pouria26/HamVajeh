-- Run this once against an existing database that was created before the
-- admin curation panel added the "needs review" flag. Safe to re-run.
--
-- Usage (adjust connection details as needed):
--   psql "$DATABASE_URL" -f src/db/migrations/001_add_needs_review.sql

ALTER TABLE collocations
    ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;
