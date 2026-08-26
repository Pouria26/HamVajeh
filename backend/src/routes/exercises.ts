import { Router, Request, Response } from "express";
import { pool } from "../db/pool";

export const exercisesRouter = Router();

// GET /api/exercises/random -> one random exercise with shuffled options
exercisesRouter.get("/random", async (_req: Request, res: Response) => {
    try {
        const { rows: exampleRows } = await pool.query(
            `SELECT e.id, e.collocation_id, e.blank_sentence, c.display_form
             FROM examples e
             JOIN collocations c ON c.id = e.collocation_id
             WHERE e.blank_sentence IS NOT NULL
             ORDER BY random()
             LIMIT 1`
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
exercisesRouter.get("/collocation/:collocationId", async (req: Request, res: Response) => {
    const collocationId = Number(req.params.collocationId);

    if (!Number.isInteger(collocationId) || collocationId <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rows: examples } = await pool.query(
            `SELECT id, blank_sentence, example_order
             FROM examples
             WHERE collocation_id = $1 AND blank_sentence IS NOT NULL
             ORDER BY example_order ASC`,
            [collocationId]
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
            `SELECT id, option_text, is_correct
             FROM exercise_options
             WHERE example_id = $1`,
            [exampleId]
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
