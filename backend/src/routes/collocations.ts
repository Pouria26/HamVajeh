import { Router, Request, Response } from "express";
import { pool } from "../db/pool";
import { PATTERN_CATEGORIES, patternsForCategory, allCategorizedPatterns } from "../lib/patternCategories";

export const collocationsRouter = Router();

// Data-driven quality thresholds, chosen from the real minmax_score distribution
// (median ~0.22, p90 ~0.35 across the 4840 imported collocations).
//
// RELATED: lenient bar so most collocations still have a few related items to show
// (only excludes the noisiest bottom half of the data).
const RELATED_QUALITY_THRESHOLD = 0.2;
// FEATURED (homepage): strict bar — only solid, natural-sounding pairs ever
// appear on the homepage, since that's the first impression and must never
// show a noisy pair.
const FEATURED_QUALITY_THRESHOLD = 0.4;
// A stricter "showcase" bar used to guarantee at least one standout item in
// every featured batch (see /featured below), so the homepage never looks
// like a flat, randomly-average sample.
const FEATURED_SHOWCASE_THRESHOLD = 0.6;
// BROWSE: same lenient bar as RELATED — this is a showcase/discovery feature,
// so it should feel populated per category while still excluding pure noise.
const BROWSE_QUALITY_THRESHOLD = 0.2;

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
                OR similarity(display_form, $1) > 0.35
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
// A random sample of high-quality collocations for the homepage, guaranteed
// to include at least one "showcase" pair (minmax_score > 0.6) alongside
// solid ones (> 0.4), so every batch feels genuinely impressive rather than
// just averagely-fine. Must be registered BEFORE the generic "/:id" route
// below, otherwise Express would try to parse "featured" as a numeric id.
collocationsRouter.get("/featured", async (req: Request, res: Response) => {
    const parsedLimit = Number(req.query.limit ?? 6);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 20) : 6;

    // At least one showcase-tier item (but never more than a third of the
    // batch, so it doesn't crowd out variety) when one is available at all.
    const showcaseCount = Math.max(1, Math.ceil(limit / 3));

    try {
        const { rows: showcaseRows } = await pool.query(
            `SELECT id, pair_id, display_form, pos_pattern, minmax_score
             FROM collocations
             WHERE minmax_score > $1
                AND pos_pattern NOT ILIKE '%PROPN%'
             ORDER BY random()
             LIMIT $2`,
            [FEATURED_SHOWCASE_THRESHOLD, showcaseCount]
        );

        const remaining = limit - showcaseRows.length;
        let restRows: typeof showcaseRows = [];
        if (remaining > 0) {
            const excludeIds = showcaseRows.map((r) => r.id);
            const { rows } = await pool.query(
                `SELECT id, pair_id, display_form, pos_pattern, minmax_score
                 FROM collocations
                 WHERE minmax_score > $1
                    AND pos_pattern NOT ILIKE '%PROPN%'
                    AND id <> ALL($2::int[])
                 ORDER BY random()
                 LIMIT $3`,
                [FEATURED_QUALITY_THRESHOLD, excludeIds, remaining]
            );
            restRows = rows;
        }

        // Shuffle the combined batch so the showcase item(s) don't always
        // land in the same position on the grid.
        const combined = [...showcaseRows, ...restRows];
        for (let i = combined.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [combined[i], combined[j]] = [combined[j], combined[i]];
        }

        res.json({ results: combined });
    } catch (err) {
        console.error("Featured fetch failed:", err);
        res.status(500).json({ error: "featured_failed" });
    }
});

// GET /api/collocations/patterns
// Counts per broad learner-facing category (see lib/patternCategories.ts),
// not per raw pos_pattern — the raw dataset has ~24 near-duplicate POS
// combinations, which is too many/too technical for a category picker.
// Counted within the same quality bar as /browse so the numbers shown match
// what the user will actually see when they open a category.
collocationsRouter.get("/patterns", async (_req: Request, res: Response) => {
    try {
        const categorized = allCategorizedPatterns();

        const { rows } = await pool.query(
            `SELECT
                CASE WHEN pos_pattern = ANY($2::text[]) THEN pos_pattern ELSE '__OTHER__' END AS bucket,
                count(*)::int AS count
             FROM collocations
             WHERE minmax_score > $1
             GROUP BY bucket`,
            [BROWSE_QUALITY_THRESHOLD, categorized]
        );

        const countByPattern = new Map<string, number>();
        let otherCount = 0;
        for (const row of rows) {
            if (row.bucket === "__OTHER__") otherCount += row.count;
            else countByPattern.set(row.bucket, row.count);
        }

        const patterns = PATTERN_CATEGORIES.map((cat) => {
            const count =
                cat.id === "OTHER"
                    ? otherCount
                    : cat.patterns.reduce((sum, p) => sum + (countByPattern.get(p) ?? 0), 0);
            return {
                category: cat.id,
                label: cat.label,
                description: cat.description,
                count,
            };
        }).filter((c) => c.count > 0);

        res.json({ patterns });
    } catch (err) {
        console.error("Patterns fetch failed:", err);
        res.status(500).json({ error: "patterns_failed" });
    }
});

// GET /api/collocations/browse?category=NOUN_NOUN&limit=24&offset=0
// Quality-filtered listing for one learner-facing category (see
// lib/patternCategories.ts), with simple offset pagination and a total count.
collocationsRouter.get("/browse", async (req: Request, res: Response) => {
    const category = String(req.query.category ?? "").trim();
    const parsedLimit = Number(req.query.limit ?? 24);
    const limit = Number.isInteger(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 60) : 24;
    const parsedOffset = Number(req.query.offset ?? 0);
    const offset = Number.isInteger(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    if (!category) {
        res.status(400).json({ error: "missing_category" });
        return;
    }

    const patterns = patternsForCategory(category);
    // "OTHER" (patterns === null) means: everything NOT covered by the other
    // 4 categories' explicit pattern lists (including a NULL pos_pattern).
    const isOther = patterns === null;
    const excludePatterns = isOther ? allCategorizedPatterns() : [];

    try {
        const whereSql = isOther
            ? `(pos_pattern IS NULL OR pos_pattern <> ALL($1::text[])) AND minmax_score > $2`
            : `pos_pattern = ANY($1::text[]) AND minmax_score > $2`;
        const params = isOther ? excludePatterns : patterns;

        const { rows } = await pool.query(
            `SELECT id, pair_id, display_form, pos_pattern, minmax_score
             FROM collocations
             WHERE ${whereSql}
             ORDER BY minmax_score DESC NULLS LAST
             LIMIT $3 OFFSET $4`,
            [params, BROWSE_QUALITY_THRESHOLD, limit, offset]
        );

        const { rows: countRows } = await pool.query(
            `SELECT count(*)::int AS total
             FROM collocations
             WHERE ${whereSql}`,
            [params, BROWSE_QUALITY_THRESHOLD]
        );

        res.json({ results: rows, total: countRows[0]?.total ?? 0 });
    } catch (err) {
        console.error("Browse fetch failed:", err);
        res.status(500).json({ error: "browse_failed" });
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

// Valid values for the reporter's chosen reason — kept narrow and simple
// since this is a quick "something's wrong" flag, not a support ticket.
const VALID_REPORT_REASONS = new Set([
    "wrong_collocation", // the word pair itself doesn't sound natural / isn't a real collocation
    "wrong_sentence",    // one of the example sentences is awkward, ungrammatical, or unrelated
    "wrong_answer",      // the multiple-choice options / correct answer for an exercise look wrong
    "other",
]);

// POST /api/collocations/:id/report
// Public endpoint (no auth) so any learner can flag a collocation or one of
// its example sentences as wrong. Reports land in a moderation queue that
// only the admin panel can see (GET/PATCH under /api/admin/reports).
// body: { reason: string, comment?: string, example_id?: number }
collocationsRouter.post("/:id/report", async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "invalid_id" });
        return;
    }

    const reason = String(req.body?.reason ?? "").trim();
    if (!VALID_REPORT_REASONS.has(reason)) {
        res.status(400).json({ error: "invalid_reason" });
        return;
    }

    const commentRaw = req.body?.comment;
    const comment =
        commentRaw !== undefined && commentRaw !== null
            ? String(commentRaw).trim().slice(0, 1000) || null
            : null;

    let exampleId: number | null = null;
    if (req.body?.example_id !== undefined && req.body?.example_id !== null) {
        const parsed = Number(req.body.example_id);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            res.status(400).json({ error: "invalid_example_id" });
            return;
        }
        exampleId = parsed;
    }

    try {
        const { rows: collocationRows } = await pool.query(`SELECT id FROM collocations WHERE id = $1`, [id]);
        if (collocationRows.length === 0) {
            res.status(404).json({ error: "not_found" });
            return;
        }

        if (exampleId !== null) {
            const { rows: exampleRows } = await pool.query(
                `SELECT id FROM examples WHERE id = $1 AND collocation_id = $2`,
                [exampleId, id]
            );
            if (exampleRows.length === 0) {
                res.status(400).json({ error: "example_not_found_for_collocation" });
                return;
            }
        }

        const { rows } = await pool.query(
            `INSERT INTO reports (collocation_id, example_id, reason, comment)
             VALUES ($1, $2, $3, $4)
             RETURNING id, collocation_id, example_id, reason, comment, status, created_at`,
            [id, exampleId, reason, comment]
        );

        res.status(201).json({ report: rows[0] });
    } catch (err) {
        console.error("Report submission failed:", err);
        res.status(500).json({ error: "report_failed" });
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
