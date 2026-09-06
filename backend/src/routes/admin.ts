import { Router, Request, Response } from "express";
import { pool } from "../db/pool";
import { deriveScoresFromQuality } from "../lib/scoreDerivation";

export const adminRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/admin/collocations?search=&status=&needs_review=1&limit=&offset=
// Full unfiltered listing (no quality threshold) for dataset curation.
//
// `status` and `needs_review` are independent filters (status is the
// valid/corrected curation outcome; needs_review is a separate "flagged for
// a second look" marker an admin can set regardless of status — see the
// "مشکوک" tab in the admin UI), so both can be combined, e.g.
// ?status=corrected&needs_review=1 for "corrected rows I'm still unsure about".
// ---------------------------------------------------------------------------
adminRouter.get("/collocations", async (req: Request, res: Response) => {
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim(); // "valid" | "corrected" | ""
    const needsReviewOnly = String(req.query.needs_review ?? "").trim() === "1";
    const parsedLimit = Number(req.query.limit ?? 50);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
    const parsedOffset = Number(req.query.offset ?? 0);
    const offset = Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
        params.push(`%${search}%`);
        conditions.push(
            `(display_form ILIKE $${params.length} OR word1 ILIKE $${params.length} OR word2 ILIKE $${params.length})`
        );
    }
    if (status === "valid" || status === "corrected") {
        params.push(status);
        conditions.push(`status = $${params.length}`);
    }
    if (needsReviewOnly) {
        conditions.push(`needs_review = true`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        params.push(limit);
        params.push(offset);

        const { rows } = await pool.query(
            `SELECT id, pair_id, word1, word2, display_form, pos_pattern, status,
                    correction_note, minmax_score, needs_review,
                    (SELECT count(*)::int FROM examples e WHERE e.collocation_id = collocations.id) AS example_count
             FROM collocations
             ${whereClause}
             ORDER BY id ASC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const { rows: countRows } = await pool.query(
            `SELECT count(*)::int AS total FROM collocations ${whereClause}`,
            params.slice(0, params.length - 2)
        );

        // Also report the total needs_review count regardless of the current
        // filter, so the admin UI can show a badge on the "مشکوک" tab without
        // an extra round trip.
        const { rows: needsReviewCountRows } = await pool.query(
            `SELECT count(*)::int AS total FROM collocations WHERE needs_review = true`
        );

        res.json({
            results: rows,
            total: countRows[0]?.total ?? 0,
            needsReviewTotal: needsReviewCountRows[0]?.total ?? 0,
        });
    } catch (err) {
        console.error("Admin list fetch failed:", err);
        res.status(500).json({ error: "admin_list_failed" });
    }
});

// ---------------------------------------------------------------------------
// POST /api/admin/collocations -> create a brand-new, hand-authored entry
// (used to add high-quality replacements for the rows the auto-generated
// dataset got wrong). Inserts the collocation plus up to 5 example
// sentences, each with its multiple-choice options, in one transaction.
// ---------------------------------------------------------------------------
interface NewExampleInput {
    sentence: string;
    blank_sentence?: string | null;
    target_phrase?: string | null;
    options?: { option_text: string; is_correct: boolean }[];
}

function buildDisplayForm(word1: string, word2: string | null | undefined): string {
    const w1 = (word1 || "").trim();
    const w2 = (word2 || "").trim();
    if (!w2) return w1;
    return `${w1} ${w2}`;
}

adminRouter.post("/collocations", async (req: Request, res: Response) => {
    const body = req.body ?? {};

    const word1 = String(body.word1 ?? "").trim();
    if (!word1) {
        res.status(400).json({ error: "word1_required" });
        return;
    }

    const word2raw = body.word2 !== undefined && body.word2 !== null ? String(body.word2).trim() : "";
    const word2 = word2raw === "" ? null : word2raw;

    const displayForm = String(body.display_form ?? "").trim() || buildDisplayForm(word1, word2);

    const status = body.status === "corrected" ? "corrected" : "valid";
    const posPattern = body.pos_pattern ? String(body.pos_pattern).trim() : null;
    const correctionNote = body.correction_note ? String(body.correction_note).trim() : null;
    const needsReview = Boolean(body.needs_review);

    // The admin only provides one overall quality number (0–1); every other
    // statistical column is fabricated from it so CSV exports keep their
    // original shape. See lib/scoreDerivation.ts for the rationale.
    const qualityScore = Number.isFinite(Number(body.minmax_score)) ? Number(body.minmax_score) : 0.5;
    const derived = deriveScoresFromQuality(qualityScore);

    const examplesInput: NewExampleInput[] = Array.isArray(body.examples) ? body.examples : [];
    if (examplesInput.length > 5) {
        res.status(400).json({ error: "too_many_examples" });
        return;
    }
    for (const ex of examplesInput) {
        if (!ex || !String(ex.sentence ?? "").trim()) {
            res.status(400).json({ error: "example_sentence_required" });
            return;
        }
        if (Array.isArray(ex.options) && ex.options.filter((o) => o.is_correct).length > 1) {
            res.status(400).json({ error: "example_has_multiple_correct_options" });
            return;
        }
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Manually-authored entries get pair_ids starting well above the
        // range used by the source CSV (which tops out well under 900000),
        // so a future re-import can never collide with hand-added rows.
        const { rows: pairIdRows } = await client.query<{ next_pair_id: number }>(
            `SELECT GREATEST(COALESCE(MAX(pair_id), 0) + 1, 900001) AS next_pair_id FROM collocations`
        );
        const pairId = pairIdRows[0].next_pair_id;

        const { rows: collocationRows } = await client.query(
            `INSERT INTO collocations
                (pair_id, word1, word2, display_form, pos_pattern, status, correction_note,
                 pmi, t_score, llr, logdice, combined_score, minmax_score, needs_review)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             RETURNING *`,
            [
                pairId,
                word1,
                word2,
                displayForm,
                posPattern,
                status,
                correctionNote,
                derived.pmi,
                derived.t_score,
                derived.llr,
                derived.logdice,
                derived.combined_score,
                qualityScore,
                needsReview,
            ]
        );
        const collocation = collocationRows[0];

        const createdExamples: unknown[] = [];

        for (let i = 0; i < examplesInput.length; i++) {
            const ex = examplesInput[i];
            const sentence = String(ex.sentence).trim();
            const blankSentence = ex.blank_sentence ? String(ex.blank_sentence).trim() : null;
            const targetPhrase = ex.target_phrase ? String(ex.target_phrase).trim() : null;

            const { rows: exampleRows } = await client.query(
                `INSERT INTO examples (collocation_id, sentence, blank_sentence, target_phrase, example_order)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, sentence, blank_sentence, target_phrase, example_order`,
                [collocation.id, sentence, blankSentence, targetPhrase, i + 1]
            );
            const example = exampleRows[0];

            const options = Array.isArray(ex.options) ? ex.options : [];
            const createdOptions: unknown[] = [];
            for (let j = 0; j < options.length; j++) {
                const opt = options[j];
                const optionText = String(opt.option_text ?? "").trim();
                if (!optionText) continue;
                const { rows: optionRows } = await client.query(
                    `INSERT INTO exercise_options (example_id, option_text, option_order, is_correct)
                     VALUES ($1, $2, $3, $4)
                     RETURNING id, example_id, option_text, option_order, is_correct`,
                    [example.id, optionText, j + 1, Boolean(opt.is_correct)]
                );
                createdOptions.push(optionRows[0]);
            }

            createdExamples.push({ ...example, options: createdOptions });
        }

        await client.query("COMMIT");

        res.status(201).json({ collocation, examples: createdExamples });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Admin create failed:", err);
        res.status(500).json({ error: "admin_create_failed" });
    } finally {
        client.release();
    }
});

// ---------------------------------------------------------------------------
// GET /api/admin/collocations/:id -> full detail incl. examples + options
// ---------------------------------------------------------------------------
adminRouter.get("/collocations/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rows: collocationRows } = await pool.query(
            `SELECT * FROM collocations WHERE id = $1`,
            [id]
        );
        if (collocationRows.length === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }

        const { rows: exampleRows } = await pool.query(
            `SELECT id, sentence, blank_sentence, target_phrase, example_order
             FROM examples WHERE collocation_id = $1 ORDER BY example_order ASC`,
            [id]
        );

        const exampleIds = exampleRows.map((e) => e.id);
        let optionsByExample = new Map<number, unknown[]>();
        if (exampleIds.length > 0) {
            const { rows: optionRows } = await pool.query(
                `SELECT id, example_id, option_text, option_order, is_correct
                 FROM exercise_options WHERE example_id = ANY($1::int[]) ORDER BY example_id, option_order`,
                [exampleIds]
            );
            optionsByExample = new Map();
            for (const o of optionRows) {
                const list = optionsByExample.get(o.example_id) ?? [];
                list.push(o);
                optionsByExample.set(o.example_id, list);
            }
        }

        res.json({
            collocation: collocationRows[0],
            examples: exampleRows.map((e) => ({
                ...e,
                options: optionsByExample.get(e.id) ?? [],
            })),
        });
    } catch (err) {
        console.error("Admin detail fetch failed:", err);
        res.status(500).json({ error: "admin_detail_failed" });
    }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/collocations/:id -> edit core fields
// ---------------------------------------------------------------------------
const EDITABLE_COLLOCATION_FIELDS = [
    "word1",
    "word2",
    "display_form",
    "pos_pattern",
    "status",
    "minmax_score",
    "needs_review",
    "correction_note",
] as const;

adminRouter.patch("/collocations/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    const body = req.body ?? {};
    const setClauses: string[] = [];
    const params: unknown[] = [];

    for (const field of EDITABLE_COLLOCATION_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            params.push(body[field]);
            setClauses.push(`${field} = $${params.length}`);
        }
    }

    if (setClauses.length === 0) {
        res.status(400).json({ error: "no_fields_to_update" });
        return;
    }

    if (body.status !== undefined && body.status !== "valid" && body.status !== "corrected") {
        res.status(400).json({ error: "invalid_status" });
        return;
    }

    if (body.display_form !== undefined && !String(body.display_form).trim()) {
        res.status(400).json({ error: "display_form_required" });
        return;
    }
    if (body.word1 !== undefined && !String(body.word1).trim()) {
        res.status(400).json({ error: "word1_required" });
        return;
    }

    // Changing the overall quality score re-derives the other statistical
    // columns too, so they stay consistent (see lib/scoreDerivation.ts).
    if (Object.prototype.hasOwnProperty.call(body, "minmax_score")) {
        const quality = Number(body.minmax_score);
        if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
            res.status(400).json({ error: "minmax_score_must_be_between_0_and_1" });
            return;
        }
        const derived = deriveScoresFromQuality(quality);
        for (const [field, value] of Object.entries(derived)) {
            params.push(value);
            setClauses.push(`${field} = $${params.length}`);
        }
    }

    params.push(id);

    try {
        const { rows } = await pool.query(
            `UPDATE collocations SET ${setClauses.join(", ")} WHERE id = $${params.length} RETURNING *`,
            params
        );
        if (rows.length === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json({ collocation: rows[0] });
    } catch (err) {
        console.error("Admin update failed:", err);
        res.status(500).json({ error: "admin_update_failed" });
    }
});

// ---------------------------------------------------------------------------
// POST /api/admin/collocations/clear-needs-review -> bulk-clear the "مشکوک"
// flag on every currently-flagged row in one shot.
//
// Why this exists: needs_review round-trips through CSV import/export now
// (see importDataset.ts), and the ORIGINAL raw dataset file has this column
// set to 1 on every single row (a leftover from an earlier pipeline stage,
// not a real per-row signal). That means a first-time import of the raw
// file floods the "مشکوک" tab with the entire dataset — which would be
// unusably tedious to clear one row at a time. This endpoint exists purely
// to give the admin a fast, one-click way to reset that flag in bulk right
// after such an import, so "مشکوک" can go back to meaning what it's meant
// to mean going forward: rows *this admin* has actively flagged.
// ---------------------------------------------------------------------------
adminRouter.post("/collocations/clear-needs-review", async (_req: Request, res: Response) => {
    try {
        const { rowCount } = await pool.query(
            `UPDATE collocations SET needs_review = false WHERE needs_review = true`
        );
        res.json({ cleared: rowCount ?? 0 });
    } catch (err) {
        console.error("Admin bulk clear-needs-review failed:", err);
        res.status(500).json({ error: "admin_bulk_clear_failed" });
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/collocations/:id -> cascades to examples + options
// ---------------------------------------------------------------------------
adminRouter.delete("/collocations/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rowCount } = await pool.query(`DELETE FROM collocations WHERE id = $1`, [id]);
        if (rowCount === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json({ deleted: true });
    } catch (err) {
        console.error("Admin delete failed:", err);
        res.status(500).json({ error: "admin_delete_failed" });
    }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/examples/:id -> edit sentence text + its options
// body: { sentence?, blank_sentence?, target_phrase?, options?: [{id, option_text, is_correct}] }
// ---------------------------------------------------------------------------
adminRouter.patch("/examples/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    const body = req.body ?? {};
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const setClauses: string[] = [];
        const params: unknown[] = [];
        for (const field of ["sentence", "blank_sentence", "target_phrase"] as const) {
            if (Object.prototype.hasOwnProperty.call(body, field)) {
                params.push(body[field]);
                setClauses.push(`${field} = $${params.length}`);
            }
        }

        if (setClauses.length > 0) {
            params.push(id);
            const { rowCount } = await client.query(
                `UPDATE examples SET ${setClauses.join(", ")} WHERE id = $${params.length}`,
                params
            );
            if (rowCount === 0) {
                await client.query("ROLLBACK");
                res.status(404).json({ error: "not_found" });
                return;
            }
        }

        if (Array.isArray(body.options)) {
            for (const opt of body.options) {
                if (!opt || !Number.isInteger(opt.id)) continue;
                const optSet: string[] = [];
                const optParams: unknown[] = [];
                if (typeof opt.option_text === "string") {
                    optParams.push(opt.option_text);
                    optSet.push(`option_text = $${optParams.length}`);
                }
                if (typeof opt.is_correct === "boolean") {
                    optParams.push(opt.is_correct);
                    optSet.push(`is_correct = $${optParams.length}`);
                }
                if (optSet.length === 0) continue;
                optParams.push(opt.id);
                optParams.push(id);
                await client.query(
                    `UPDATE exercise_options SET ${optSet.join(", ")} WHERE id = $${optParams.length - 1} AND example_id = $${optParams.length}`,
                    optParams
                );
            }
        }

        await client.query("COMMIT");

        const { rows: exampleRows } = await pool.query(
            `SELECT id, sentence, blank_sentence, target_phrase, example_order FROM examples WHERE id = $1`,
            [id]
        );
        const { rows: optionRows } = await pool.query(
            `SELECT id, example_id, option_text, option_order, is_correct FROM exercise_options WHERE example_id = $1 ORDER BY option_order`,
            [id]
        );

        res.json({ example: { ...exampleRows[0], options: optionRows } });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Admin example update failed:", err);
        res.status(500).json({ error: "admin_example_update_failed" });
    } finally {
        client.release();
    }
});

// ---------------------------------------------------------------------------
// POST /api/admin/examples/:id/options -> add one manually-written distractor
// (or correct option) to an existing example. Supports the fully-manual
// workflow: type the real sentence + real answer, then just add 2–3 real,
// meaningful wrong words yourself.
// ---------------------------------------------------------------------------
adminRouter.post("/examples/:id/options", async (req: Request, res: Response) => {
    const exampleId = Number(req.params.id);
    if (!Number.isInteger(exampleId) || exampleId <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    const optionText = String(req.body?.option_text ?? "").trim();
    if (!optionText) {
        res.status(400).json({ error: "option_text_required" });
        return;
    }
    const isCorrect = Boolean(req.body?.is_correct);

    try {
        const { rows: exampleRows } = await pool.query(`SELECT id FROM examples WHERE id = $1`, [exampleId]);
        if (exampleRows.length === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }

        const { rows: maxRows } = await pool.query<{ next_order: number }>(
            `SELECT COALESCE(MAX(option_order), 0) + 1 AS next_order FROM exercise_options WHERE example_id = $1`,
            [exampleId]
        );

        const { rows } = await pool.query(
            `INSERT INTO exercise_options (example_id, option_text, option_order, is_correct)
             VALUES ($1, $2, $3, $4)
             RETURNING id, example_id, option_text, option_order, is_correct`,
            [exampleId, optionText, maxRows[0].next_order, isCorrect]
        );

        res.status(201).json({ option: rows[0] });
    } catch (err) {
        console.error("Admin add option failed:", err);
        res.status(500).json({ error: "admin_add_option_failed" });
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/options/:id -> remove a single distractor/option
// ---------------------------------------------------------------------------
adminRouter.delete("/options/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rowCount } = await pool.query(`DELETE FROM exercise_options WHERE id = $1`, [id]);
        if (rowCount === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json({ deleted: true });
    } catch (err) {
        console.error("Admin delete option failed:", err);
        res.status(500).json({ error: "admin_delete_option_failed" });
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/examples/:id -> also removes its exercise_options (cascade)
// ---------------------------------------------------------------------------
adminRouter.delete("/examples/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rowCount } = await pool.query(`DELETE FROM examples WHERE id = $1`, [id]);
        if (rowCount === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json({ deleted: true });
    } catch (err) {
        console.error("Admin example delete failed:", err);
        res.status(500).json({ error: "admin_example_delete_failed" });
    }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/collocations/:id/reorder-examples
// body: { orderedIds: number[] } — example ids for this collocation, in the
// desired final order. Runs in two passes (negative temp orders first) to
// avoid violating the UNIQUE (collocation_id, example_order) constraint.
// ---------------------------------------------------------------------------
adminRouter.patch("/collocations/:id/reorder-examples", async (req: Request, res: Response) => {
    const collocationId = Number(req.params.id);
    const orderedIds = req.body?.orderedIds;

    if (!Number.isInteger(collocationId) || collocationId <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }
    if (!Array.isArray(orderedIds) || orderedIds.length === 0 || !orderedIds.every((n) => Number.isInteger(n))) {
        res.status(400).json({ error: "invalid_ordered_ids" });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const { rows: existing } = await client.query(
            `SELECT id FROM examples WHERE collocation_id = $1`,
            [collocationId]
        );
        const existingIds = new Set(existing.map((r) => r.id));

        if (orderedIds.length !== existingIds.size || !orderedIds.every((eid) => existingIds.has(eid))) {
            await client.query("ROLLBACK");
            res.status(400).json({ error: "ordered_ids_mismatch" });
            return;
        }

        // Pass 1: move everything to negative, collision-free temp positions.
        for (let i = 0; i < orderedIds.length; i++) {
            await client.query(
                `UPDATE examples SET example_order = $1 WHERE id = $2 AND collocation_id = $3`,
                [-(i + 1), orderedIds[i], collocationId]
            );
        }
        // Pass 2: assign final 1-based positions.
        for (let i = 0; i < orderedIds.length; i++) {
            await client.query(
                `UPDATE examples SET example_order = $1 WHERE id = $2 AND collocation_id = $3`,
                [i + 1, orderedIds[i], collocationId]
            );
        }

        await client.query("COMMIT");

        const { rows } = await pool.query(
            `SELECT id, sentence, blank_sentence, target_phrase, example_order
             FROM examples WHERE collocation_id = $1 ORDER BY example_order ASC`,
            [collocationId]
        );
        res.json({ examples: rows });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Admin reorder failed:", err);
        res.status(500).json({ error: "admin_reorder_failed" });
    } finally {
        client.release();
    }
});

// ---------------------------------------------------------------------------
// GET /api/admin/reports?status=pending&limit=&offset=
// Moderation queue for user-submitted "this looks wrong" reports (created
// via the public POST /api/collocations/:id/report). Joins in the reported
// collocation's display form (and example sentence, if the report was about
// a specific example) so the admin doesn't have to look it up separately.
// ---------------------------------------------------------------------------
adminRouter.get("/reports", async (req: Request, res: Response) => {
    const status = String(req.query.status ?? "").trim(); // "pending" | "resolved" | "dismissed" | ""
    const parsedLimit = Number(req.query.limit ?? 50);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
    const parsedOffset = Number(req.query.offset ?? 0);
    const offset = Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (status === "pending" || status === "resolved" || status === "dismissed") {
        params.push(status);
        conditions.push(`r.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        params.push(limit);
        params.push(offset);

        const { rows } = await pool.query(
            `SELECT r.id, r.collocation_id, r.example_id, r.reason, r.comment, r.status, r.created_at,
                    c.display_form AS collocation_display_form, c.pair_id AS collocation_pair_id,
                    e.sentence AS example_sentence
             FROM reports r
             JOIN collocations c ON c.id = r.collocation_id
             LEFT JOIN examples e ON e.id = r.example_id
             ${whereClause}
             ORDER BY (r.status = 'pending') DESC, r.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const { rows: countRows } = await pool.query(
            `SELECT count(*)::int AS total FROM reports r ${whereClause}`,
            params.slice(0, params.length - 2)
        );

        const { rows: pendingRows } = await pool.query(
            `SELECT count(*)::int AS pending FROM reports WHERE status = 'pending'`
        );

        res.json({ results: rows, total: countRows[0]?.total ?? 0, pending: pendingRows[0]?.pending ?? 0 });
    } catch (err) {
        console.error("Admin reports fetch failed:", err);
        res.status(500).json({ error: "admin_reports_failed" });
    }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/reports/:id -> mark a report resolved / dismissed / pending
// body: { status: 'pending' | 'resolved' | 'dismissed' }
// ---------------------------------------------------------------------------
adminRouter.patch("/reports/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    const status = String(req.body?.status ?? "").trim();
    if (status !== "pending" && status !== "resolved" && status !== "dismissed") {
        res.status(400).json({ error: "invalid_status" });
        return;
    }

    try {
        const { rows } = await pool.query(
            `UPDATE reports SET status = $1 WHERE id = $2 RETURNING id, collocation_id, example_id, reason, comment, status, created_at`,
            [status, id]
        );
        if (rows.length === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json({ report: rows[0] });
    } catch (err) {
        console.error("Admin report update failed:", err);
        res.status(500).json({ error: "admin_report_update_failed" });
    }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/reports/:id -> remove a report from the queue entirely
// ---------------------------------------------------------------------------
adminRouter.delete("/reports/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rowCount } = await pool.query(`DELETE FROM reports WHERE id = $1`, [id]);
        if (rowCount === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        res.json({ deleted: true });
    } catch (err) {
        console.error("Admin report delete failed:", err);
        res.status(500).json({ error: "admin_report_delete_failed" });
    }
});

// ---------------------------------------------------------------------------
// GET /api/admin/export/csv -> full dataset, in (almost) the same column
// layout as the original final_df.csv: all the original columns are kept in
// their original order, plus two additions — "display_form" (inserted right
// after word2_final) and a trailing "needs_review" 0/1 column.
//
// display_form matters here because it's the one field an admin can edit
// that ISN'T simply derived from word1/word2 (e.g. fixing spacing, ZWNJ
// placement, or word order that the automatic "word1 word2" join gets
// wrong). Without exporting it, re-importing this CSV via
// `npm run import-csv` would silently regenerate display_form from
// word1_final/word2_final and any such manual fix would be lost — which
// is exactly the "have to redo everything from scratch" bug this column
// fixes. importDataset.ts reads this column back in and only falls back to
// auto-building it when the column is blank/absent (e.g. for the original
// final_df.csv, which never had it), so re-importing an export you haven't
// touched still behaves identically to before.
//
// Caveat: the source columns word1_orig/word2_orig captured the pre-edit
// spelling from the original corpus run. We don't keep a separate "before
// edit" copy of the words, so both the *_orig and *_final columns here are
// simply the current word1/word2 — that history isn't preserved once you
// edit a row in the admin panel.
// ---------------------------------------------------------------------------
const CSV_COLUMNS = [
    "pair_id",
    "word1_orig",
    "word2_orig",
    "pos_pattern",
    "status",
    "word1_final",
    "word2_final",
    "display_form",
    "reason",
    "pmi",
    "t_score",
    "llr",
    "logdice",
    "combined_score",
    "minmax_score",
    ...Array.from({ length: 5 }, (_, i) => [`sentence_${i + 1}`, `blank_${i + 1}`, `answer_blank_${i + 1}`]).flat(),
    "needs_review",
] as const;

function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

adminRouter.get("/export/csv", async (_req: Request, res: Response) => {
    try {
        const { rows: collocations } = await pool.query(
            `SELECT * FROM collocations ORDER BY pair_id ASC`
        );

        const collocationIds = collocations.map((c) => c.id);
        const examplesByCollocation = new Map<number, unknown[]>();
        const optionsByExample = new Map<number, unknown[]>();

        if (collocationIds.length > 0) {
            const { rows: exampleRows } = await pool.query(
                `SELECT id, collocation_id, sentence, blank_sentence, target_phrase, example_order
                 FROM examples WHERE collocation_id = ANY($1::int[]) ORDER BY collocation_id, example_order`,
                [collocationIds]
            );
            for (const e of exampleRows) {
                const list = examplesByCollocation.get(e.collocation_id) ?? [];
                list.push(e);
                examplesByCollocation.set(e.collocation_id, list);
            }

            const exampleIds = exampleRows.map((e) => e.id);
            if (exampleIds.length > 0) {
                const { rows: optionRows } = await pool.query(
                    // Correct option first (to match the original answer_blank_N JSON
                    // shape), even if an admin edit moved it to a different option_order.
                    `SELECT id, example_id, option_text, option_order, is_correct
                     FROM exercise_options WHERE example_id = ANY($1::int[])
                     ORDER BY example_id, is_correct DESC, option_order ASC`,
                    [exampleIds]
                );
                for (const o of optionRows) {
                    const list = optionsByExample.get(o.example_id) ?? [];
                    list.push(o);
                    optionsByExample.set(o.example_id, list);
                }
            }
        }

        const lines: string[] = [CSV_COLUMNS.join(",")];

        for (const c of collocations) {
            const examples = (examplesByCollocation.get(c.id) ?? []) as {
                id: number;
                sentence: string;
                blank_sentence: string | null;
                target_phrase: string | null;
            }[];

            const row: Record<string, unknown> = {
                pair_id: c.pair_id,
                word1_orig: c.word1,
                word2_orig: c.word2 ?? "",
                pos_pattern: c.pos_pattern ?? "",
                status: c.status,
                word1_final: c.word1,
                word2_final: c.word2 ?? "",
                display_form: c.display_form ?? "",
                reason: c.correction_note ?? "",
                pmi: c.pmi ?? "",
                t_score: c.t_score ?? "",
                llr: c.llr ?? "",
                logdice: c.logdice ?? "",
                combined_score: c.combined_score ?? "",
                minmax_score: c.minmax_score ?? "",
                needs_review: c.needs_review ? 1 : 0,
            };

            for (let i = 0; i < 5; i++) {
                const ex = examples[i];
                const n = i + 1;
                if (!ex) {
                    row[`sentence_${n}`] = "";
                    row[`blank_${n}`] = "";
                    row[`answer_blank_${n}`] = "";
                    continue;
                }
                const options = (optionsByExample.get(ex.id) ?? []) as { option_text: string }[];
                row[`sentence_${n}`] = ex.sentence;
                row[`blank_${n}`] = ex.blank_sentence ?? "";
                row[`answer_blank_${n}`] =
                    options.length > 0 ? JSON.stringify(options.map((o) => o.option_text)) : "";
            }

            lines.push(CSV_COLUMNS.map((col) => csvEscape(row[col])).join(","));
        }

        const csvBody = "\uFEFF" + lines.join("\r\n") + "\r\n";

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="hamvajeh_export.csv"`);
        res.send(csvBody);
    } catch (err) {
        console.error("Admin CSV export failed:", err);
        res.status(500).json({ error: "admin_export_failed" });
    }
});
