import { Router, Request, Response } from "express";
import { pool } from "../db/pool";

export const adminRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/admin/collocations?search=&status=&limit=&offset=
// Full unfiltered listing (no quality threshold) for dataset curation.
// ---------------------------------------------------------------------------
adminRouter.get("/collocations", async (req: Request, res: Response) => {
    const search = String(req.query.search ?? "").trim();
    const status = String(req.query.status ?? "").trim(); // "valid" | "corrected" | ""
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
        params.push(limit);
        params.push(offset);

        const { rows } = await pool.query(
            `SELECT id, pair_id, word1, word2, display_form, pos_pattern, status,
                    correction_note, minmax_score,
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

        res.json({ results: rows, total: countRows[0]?.total ?? 0 });
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

    const minmaxScore = Number.isFinite(Number(body.minmax_score)) ? Number(body.minmax_score) : 0.5;
    const pmi = body.pmi !== undefined && body.pmi !== null && body.pmi !== "" ? Number(body.pmi) : null;
    const tScore =
        body.t_score !== undefined && body.t_score !== null && body.t_score !== "" ? Number(body.t_score) : null;
    const llr = body.llr !== undefined && body.llr !== null && body.llr !== "" ? Number(body.llr) : null;
    const logdice =
        body.logdice !== undefined && body.logdice !== null && body.logdice !== "" ? Number(body.logdice) : null;
    const combinedScore =
        body.combined_score !== undefined && body.combined_score !== null && body.combined_score !== ""
            ? Number(body.combined_score)
            : null;

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
                 pmi, t_score, llr, logdice, combined_score, minmax_score)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                pairId,
                word1,
                word2,
                displayForm,
                posPattern,
                status,
                correctionNote,
                pmi,
                tScore,
                llr,
                logdice,
                combinedScore,
                minmaxScore,
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
const EDITABLE_COLLOCATION_FIELDS = ["word1", "word2", "display_form", "pos_pattern", "status"] as const;

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
