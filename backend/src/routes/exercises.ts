import { Router, Request, Response } from "express";
import { pool } from "../db/pool";
import { PUBLIC_MIN_SCORE, requireAtLeastFloor } from "../lib/visibility";

export const exercisesRouter = Router();

// Same lenient quality bar used for /browse and /related — the daily challenge
// is a showcase feature, so it should never surface a noisy, low-score pair.
// Wrapped in requireAtLeastFloor() so it can never end up more lenient than
// the public visibility floor (see lib/visibility.ts).
const CHALLENGE_QUALITY_THRESHOLD = requireAtLeastFloor(0.2);
const CHALLENGE_SIZE = 5;

// Turns a date string like "2026-08-29" into a stable float in (-1, 1),
// which is what Postgres's setseed() requires. Same date -> same seed always.
function dateToSeed(dateStr: string): number {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
    }
    return ((hash % 1000) + 1000) % 1000 / 1000 - 0.5; // -> range (-0.5, 0.5)
}

function todayUTC(): string {
    return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// GET /api/exercises/daily-challenge
// Returns the SAME 5 exercises for everyone, for the whole UTC day — deterministic
// via Postgres setseed() derived from today's date, not fresh randomness per call.
exercisesRouter.get("/daily-challenge", async (_req: Request, res: Response) => {
    const date = todayUTC();
    const seed = dateToSeed(date);

    // setseed() is connection-scoped, so we must run the seed + the query on the
    // SAME client (not pool.query, which may hand out a different connection).
    const client = await pool.connect();
    try {
        await client.query("SELECT setseed($1)", [seed]);

        const { rows: exampleRows } = await client.query(
            `SELECT e.id, e.collocation_id, e.blank_sentence, c.display_form
             FROM examples e
             JOIN collocations c ON c.id = e.collocation_id
             WHERE e.blank_sentence IS NOT NULL
                AND c.minmax_score > $1
             ORDER BY random()
             LIMIT $2`,
            [CHALLENGE_QUALITY_THRESHOLD, CHALLENGE_SIZE]
        );

        if (exampleRows.length === 0) {
            res.status(404).json({ error: "no_exercises_available" });
            return;
        }

        const exampleIds = exampleRows.map((r) => r.id);
        const { rows: optionRows } = await client.query(
            `SELECT id, example_id, option_text, option_order
             FROM exercise_options
             WHERE example_id = ANY($1::int[])
             ORDER BY option_order ASC`,
            [exampleIds]
        );

        const optionsByExample = new Map<number, { id: number; text: string }[]>();
        for (const o of optionRows) {
            const list = optionsByExample.get(o.example_id) ?? [];
            list.push({ id: o.id, text: o.option_text });
            optionsByExample.set(o.example_id, list);
        }

        res.json({
            date,
            exercises: exampleRows.map((e) => ({
                exampleId: e.id,
                collocationDisplayForm: e.display_form,
                blankSentence: e.blank_sentence,
                options: optionsByExample.get(e.id) ?? [],
            })),
        });
    } catch (err) {
        console.error("Daily challenge fetch failed:", err);
        res.status(500).json({ error: "daily_challenge_failed" });
    } finally {
        client.release();
    }
});

// GET /api/exercises/random -> one random exercise with shuffled options
//
// Joins to collocations to enforce the public visibility floor — without
// this, a hidden (below-threshold) collocation's exercises could still turn
// up here even though its own detail page 404s and it's absent from search.
exercisesRouter.get("/random", async (_req: Request, res: Response) => {
    try {
        const { rows: exampleRows } = await pool.query(
            `SELECT e.id, e.collocation_id, e.blank_sentence, c.display_form
             FROM examples e
             JOIN collocations c ON c.id = e.collocation_id
             WHERE e.blank_sentence IS NOT NULL
                AND c.minmax_score >= $1
             ORDER BY random()
             LIMIT 1`,
            [PUBLIC_MIN_SCORE]
        );

        if (exampleRows.length === 0) {
            res.status(404).json({ error: "no_exercises_available" });
            return;
        }

        const example = exampleRows[0];

        const { rows: optionRows } = await pool.query(
            `SELECT id, option_text
             FROM exercise_options
             WHERE example_id = $1
             ORDER BY random()`,
            [example.id]
        );

        res.json({
            exampleId: example.id,
            collocationId: example.collocation_id,
            collocationDisplayForm: example.display_form,
            blankSentence: example.blank_sentence,
            options: optionRows.map((o) => ({ id: o.id, text: o.option_text })),
        });
    } catch (err) {
        console.error("Random exercise fetch failed:", err);
        res.status(500).json({ error: "random_exercise_failed" });
    }
});

// GET /api/exercises/collocation/:collocationId -> all exercises for one collocation
//
// If the collocation itself is below the public visibility floor, this
// returns an empty list — same shape as "no examples", never a distinct
// error — so it can't be used to detect a hidden row's existence.
exercisesRouter.get("/collocation/:collocationId", async (req: Request, res: Response) => {
    const collocationId = Number(req.params.collocationId);

    if (!Number.isInteger(collocationId) || collocationId <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rows: examples } = await pool.query(
            `SELECT e.id, e.blank_sentence, e.example_order
             FROM examples e
             JOIN collocations c ON c.id = e.collocation_id
             WHERE e.collocation_id = $1
                AND e.blank_sentence IS NOT NULL
                AND c.minmax_score >= $2
             ORDER BY e.example_order ASC`,
            [collocationId, PUBLIC_MIN_SCORE]
        );

        const exampleIds = examples.map((e) => e.id);

        if (exampleIds.length === 0) {
            res.json({ exercises: [] });
            return;
        }

        const { rows: options } = await pool.query(
            `SELECT id, example_id, option_text
             FROM exercise_options
             WHERE example_id = ANY($1::int[])
             ORDER BY example_id, random()`,
            [exampleIds]
        );

        const optionsByExample = new Map<number, { id: number; text: string }[]>();

        for (const o of options) {
            const list = optionsByExample.get(o.example_id) ?? [];
            list.push({ id: o.id, text: o.option_text });
            optionsByExample.set(o.example_id, list);
        }

        res.json({
            exercises: examples.map((e) => ({
                exampleId: e.id,
                exampleOrder: e.example_order,
                blankSentence: e.blank_sentence,
                options: optionsByExample.get(e.id) ?? [],
            })),
        });
    } catch (err) {
        console.error("Collocation exercises fetch failed:", err);
        res.status(500).json({ error: "collocation_exercises_failed" });
    }
});

// POST /api/exercises/:exampleId/check -> check selected answer
//
// Joins through to the owning collocation to enforce the visibility floor —
// otherwise this would leak the correct answer for a hidden collocation's
// exercise to anyone who guesses/enumerates an exampleId, even though
// nothing else on the public site can lead them there.
exercisesRouter.post("/:exampleId/check", async (req: Request, res: Response) => {
    const exampleId = Number(req.params.exampleId);
    const optionId = Number(req.body?.optionId);

    if (
        !Number.isInteger(exampleId) ||
        exampleId <= 0 ||
        !Number.isInteger(optionId) ||
        optionId <= 0
    ) {
        res.status(400).json({ error: "invalid_input" });
        return;
    }

    try {
        const { rows } = await pool.query(
            `SELECT eo.id, eo.option_text, eo.is_correct
             FROM exercise_options eo
             JOIN examples e ON e.id = eo.example_id
             JOIN collocations c ON c.id = e.collocation_id
             WHERE eo.example_id = $1 AND c.minmax_score >= $2`,
            [exampleId, PUBLIC_MIN_SCORE]
        );

        const chosen = rows.find((r) => r.id === optionId);
        const correct = rows.find((r) => r.is_correct === true);

        if (!chosen || !correct) {
            res.status(404).json({ error: "exercise_not_found" });
            return;
        }

        res.json({
            isCorrect: chosen.is_correct === true,
            correctAnswer: correct.option_text,
        });
    } catch (err) {
        console.error("Answer check failed:", err);
        res.status(500).json({ error: "check_failed" });
    }
});
