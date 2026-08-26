import { Router, Request, Response } from "express";
import { pool } from "../db/pool";

export const collocationsRouter = Router();

// GET /api/collocations/search?q=قرار&limit=20
collocationsRouter.get("/search", async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 20) || 20, 50);

    if (!q) {
        res.json({ results: [] });
        return;
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, display_form, pos_pattern, minmax_score
             FROM collocations
             WHERE display_form ILIKE '%' || $1 || '%'
                OR similarity(display_form, $1) > 0.15
             ORDER BY
                (display_form ILIKE $1 || '%') DESC,  -- prefix matches first
                similarity(display_form, $1) DESC,
                minmax_score DESC
             LIMIT $2`,
            [q, limit]
        );
        res.json({ results: rows });
    } catch (err) {
        console.error("Search failed:", err);
        res.status(500).json({ error: "search_failed" });
    }
});

// GET /api/collocations/:id  -> full detail + example sentences (no options/answers here)
collocationsRouter.get("/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rows: collocationRows } = await pool.query(
            `SELECT id, display_form, word1, word2, pos_pattern, pmi, t_score, llr, logdice, combined_score, minmax_score
             FROM collocations WHERE id = $1`,
            [id]
        );
        if (collocationRows.length === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }

        const { rows: exampleRows } = await pool.query(
            `SELECT id, sentence, example_order FROM examples WHERE collocation_id = $1 ORDER BY example_order ASC`,
            [id]
        );

        res.json({ collocation: collocationRows[0], examples: exampleRows });
    } catch (err) {
        console.error("Detail fetch failed:", err);
        res.status(500).json({ error: "detail_failed" });
    }
});
