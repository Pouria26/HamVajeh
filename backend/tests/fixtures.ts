import fs from "fs";
import path from "path";
import { pool } from "../src/db/pool";

/**
 * Rebuilds the test database schema from scratch and inserts a small,
 * deterministic set of fixture rows. This is intentionally NOT the real
 * final_df.csv (that would make tests slow and non-deterministic) — it's a
 * hand-picked minimal dataset that exercises every code path the routes use.
 */
export async function resetTestDatabase() {
    const schemaPath = path.join(__dirname, "..", "src", "db", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");
    await pool.query(schemaSql);

    // Collocation 1: normal two-word collocation, 2 examples with full exercises
    const c1 = await pool.query<{ id: number }>(
        `INSERT INTO collocations
            (pair_id, word1, word2, display_form, pos_pattern, status, correction_note,
             pmi, t_score, llr, logdice, combined_score, minmax_score)
         VALUES (1, 'قرار', 'گرفتن', 'قرار گرفتن', 'NOUN+VERB', 'valid', NULL,
                 7.1, 48.8, 21065.7, 12.4, 0.94, 0.74)
         RETURNING id`
    );
    const c1Id = c1.rows[0].id;

    const e1 = await pool.query<{ id: number }>(
        `INSERT INTO examples (collocation_id, sentence, blank_sentence, target_phrase, example_order)
         VALUES ($1, 'او مورد تشویق قرار گرفت.', 'او ___________.', 'مورد تشویق قرار گرفت', 1)
         RETURNING id`,
        [c1Id]
    );
    const e1Id = e1.rows[0].id;

    await pool.query(
        `INSERT INTO exercise_options (example_id, option_text, option_order, is_correct)
         VALUES
            ($1, 'مورد تشویق قرار گرفت', 1, true),
            ($1, 'سپردن', 2, false),
            ($1, 'زدن', 3, false),
            ($1, 'دیدن', 4, false)`,
        [e1Id]
    );

    // Second example for the same collocation, so /exercises/collocation/:id returns >1 item
    const e2 = await pool.query<{ id: number }>(
        `INSERT INTO examples (collocation_id, sentence, blank_sentence, target_phrase, example_order)
         VALUES ($1, 'این طرح باید دوباره مورد بحث قرار گیرد.', 'این طرح باید دوباره ___________.', 'مورد بحث قرار گیرد', 2)
         RETURNING id`,
        [c1Id]
    );
    const e2Id = e2.rows[0].id;

    await pool.query(
        `INSERT INTO exercise_options (example_id, option_text, option_order, is_correct)
         VALUES
            ($1, 'مورد بحث قرار گیرد', 1, true),
            ($1, 'نشستن', 2, false),
            ($1, 'رفتن', 3, false),
            ($1, 'جستن', 4, false)`,
        [e2Id]
    );

    // Collocation 2: merged compound (word2 is NULL), used to test the display_form edge case
    await pool.query(
        `INSERT INTO collocations
            (pair_id, word1, word2, display_form, pos_pattern, status, correction_note,
             pmi, t_score, llr, logdice, combined_score, minmax_score)
         VALUES (2, 'گفتگو', NULL, 'گفتگو', 'NOUN+NOUN', 'corrected', 'merged compound',
                 11.3, 28.5, 13414.7, 13.8, 0.99, 0.71)`
    );

    // Collocation 3: no examples at all, used to test the "empty examples" response shape
    await pool.query(
        `INSERT INTO collocations
            (pair_id, word1, word2, display_form, pos_pattern, status, correction_note,
             pmi, t_score, llr, logdice, combined_score, minmax_score)
         VALUES (3, 'هفته‌نامه', 'منتشر کردن', 'هفته‌نامه منتشر کردن', 'NOUN+VERB', 'valid', NULL,
                 5.0, 20.0, 5000.0, 10.0, 0.8, 0.5)`
    );

    // Collocation 4: flagged needs_review = true, used by the admin "مشکوک" queue tests
    await pool.query(
        `INSERT INTO collocations
            (pair_id, word1, word2, display_form, pos_pattern, status, correction_note,
             pmi, t_score, llr, logdice, combined_score, minmax_score, needs_review)
         VALUES (4, 'چندی', 'قبل', 'چندی قبل', 'NOUN+ADP', 'valid', NULL,
                 4.0, 15.0, 3000.0, 8.0, 0.6, 0.4, true)`
    );

    // Collocation 5: below the public visibility floor (PUBLIC_MIN_SCORE = 0.15),
    // used by the "hidden from the public site, visible in admin" tests. Shares
    // word1 ('قرار') with collocation 1 specifically so we can also confirm it's
    // excluded from collocation 1's /related results. Has one full exercise
    // (blank_sentence + options) so exercise-endpoint visibility can be tested too.
    const c5 = await pool.query<{ id: number }>(
        `INSERT INTO collocations
            (pair_id, word1, word2, display_form, pos_pattern, status, correction_note,
             pmi, t_score, llr, logdice, combined_score, minmax_score)
         VALUES (5, 'قرار', 'دادن', 'قرار دادن', 'NOUN+VERB', 'valid', NULL,
                 1.0, 5.0, 100.0, 3.0, 0.1, 0.05)
         RETURNING id`
    );
    const c5Id = c5.rows[0].id;

    const e5 = await pool.query<{ id: number }>(
        `INSERT INTO examples (collocation_id, sentence, blank_sentence, target_phrase, example_order)
         VALUES ($1, 'او پرونده را روی میز قرار داد.', 'او پرونده را روی میز ___________.', 'قرار داد', 1)
         RETURNING id`,
        [c5Id]
    );
    const e5Id = e5.rows[0].id;

    await pool.query(
        `INSERT INTO exercise_options (example_id, option_text, option_order, is_correct)
         VALUES
            ($1, 'قرار داد', 1, true),
            ($1, 'برداشت', 2, false),
            ($1, 'شکست', 3, false),
            ($1, 'بست', 4, false)`,
        [e5Id]
    );
}

export async function closeTestDatabase() {
    await pool.end();
}
