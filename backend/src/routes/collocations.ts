import { Router, Request, Response } from "express";
import { pool } from "../db/pool";

export const collocationsRouter = Router();

// Data-driven quality thresholds, chosen from the real minmax_score distribution
// (median ~0.22, p90 ~0.35 across the 4840 imported collocations).
//
// RELATED: lenient bar so most collocations still have a few related items to show
// (only excludes the noisiest bottom half of the data).
const RELATED_QUALITY_THRESHOLD = 0.2;
// FEATURED (homepage): strict bar — only the clear top ~10% ever appears on the
// homepage, since that's the first impression and must never show a noisy pair.
const FEATURED_QUALITY_THRESHOLD = 0.35;

// GET /api/collocations/search?q=قرار&limit=20
// Intentionally NOT quality-filtered: the learner should be able to find and see
// everything that matches their query, ranked by score rather than hidden by it.
collocationsRouter.get("/search", async (req: Request, res: Response) => {
    const q = String(req.query.q ?? "").trim();
    const parsedLimit = Number(req.query.limit ?? 20);
    const limit = Number.isInteger(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 50)
        : 20;

    if (!q) {
        res.json({ results: [] });
        return;
    }

    try {
        const { rows } = await pool.query(
            `SELECT id, pair_id, display_form, pos_pattern, minmax_score
             FROM collocations
             WHERE display_form ILIKE '%' || $1 || '%'
                OR similarity(display_form, $1) > 0.5
             ORDER BY
                (display_form ILIKE $1 || '%') DESC,
                similarity(display_form, $1) DESC,
                minmax_score DESC NULLS LAST
             LIMIT $2`,
            [q, limit]
        );

        res.json({ results: rows });
    } catch (err) {
        console.error("Search failed:", err);
        res.status(500).json({ error: "search_failed" });
    }
});

// GET /api/collocations/featured?limit=6
// A random sample of high-quality collocations for the homepage. Must be
// registered BEFORE the generic "/:id" route below, otherwise Express would
// try to parse "featured" as a numeric id and return 400 instead.
collocationsRouter.get("/featured", async (req: Request, res: Response) => {
    const parsedLimit = Number(req.query.limit ?? 6);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 6;

    try {
        const { rows } = await pool.query(
            `SELECT id, pair_id, display_form, pos_pattern, minmax_score
             FROM collocations
             WHERE minmax_score > $1
                AND pos_pattern NOT ILIKE '%PROPN%'
             ORDER BY random()
             LIMIT $2`,
            [FEATURED_QUALITY_THRESHOLD, limit]
        );

        res.json({ results: rows });
    } catch (err) {
        console.error("Featured fetch failed:", err);
        res.status(500).json({ error: "featured_failed" });
    }
});

// GET /api/collocations/:id -> full detail + example sentences
collocationsRouter.get("/:id", async (req: Request, res: Response) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rows: collocationRows } = await pool.query(
            `SELECT id, pair_id, display_form, word1, word2, pos_pattern,
                    pmi, t_score, llr, logdice, combined_score, minmax_score
             FROM collocations
             WHERE id = $1`,
            [id]
        );

        if (collocationRows.length === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }

        const { rows: exampleRows } = await pool.query(
            `SELECT id, sentence, example_order
             FROM examples
             WHERE collocation_id = $1
             ORDER BY example_order ASC`,
            [id]
        );

        res.json({
            collocation: collocationRows[0],
            examples: exampleRows,
        });
    } catch (err) {
        console.error("Detail fetch failed:", err);
        res.status(500).json({ error: "detail_failed" });
    }
});

// GET /api/collocations/:id/related?limit=6
// Other collocations that share word1 or word2 with this one (e.g. "قرار گرفتن"
// relates to "قرار دادن", "قرار داشتن"), filtered to a lenient quality bar so
// most collocations still surface a few related items.
collocationsRouter.get("/:id/related", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const parsedLimit = Number(req.query.limit ?? 6);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 6;

    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    try {
        const { rows: baseRows } = await pool.query<{ word1: string; word2: string | null }>(
            `SELECT word1, word2 FROM collocations WHERE id = $1`,
            [id]
        );

        if (baseRows.length === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }

        const { word1, word2 } = baseRows[0];

        const { rows } = await pool.query(
            `SELECT id, pair_id, display_form, pos_pattern, minmax_score
             FROM collocations
             WHERE id <> $1
                AND minmax_score > $2
                AND (
                    word1 = $3
                    OR word2 = $3
                    OR ($4::text IS NOT NULL AND (word1 = $4 OR word2 = $4))
                )
             ORDER BY minmax_score DESC NULLS LAST
             LIMIT $5`,
            [id, RELATED_QUALITY_THRESHOLD, word1, word2, limit]
        );

        res.json({ results: rows });
    } catch (err) {
        console.error("Related fetch failed:", err);
        res.status(500).json({ error: "related_failed" });
    }
});
