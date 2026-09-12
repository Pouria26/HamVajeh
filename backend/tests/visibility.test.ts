import request from "supertest";
import { createApp } from "../src/app";
import { resetTestDatabase, closeTestDatabase } from "./fixtures";

// Same rationale as admin.test.ts: adminAuth reads process.env.ADMIN_TOKEN
// per-request, so setting it here (even if another test file already did)
// is sufficient and keeps this file runnable on its own.
const ADMIN_TOKEN = "test-admin-token";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;

const app = createApp();
const authHeader = { Authorization: `Bearer ${ADMIN_TOKEN}` };

// Collocation 5 in fixtures.ts ("قرار دادن", minmax_score 0.05) is the one
// row deliberately below PUBLIC_MIN_SCORE (0.15). It shares word1 ("قرار")
// with collocation 1 ("قرار گرفتن") specifically so we can also confirm it's
// excluded from another collocation's /related list, not just its own routes.
let hiddenId: number;
let hiddenExampleId: number;
let hiddenCorrectOptionId: number;
let visibleId: number; // collocation 1, "قرار گرفتن" — should behave normally throughout

beforeAll(async () => {
    await resetTestDatabase();

    const list = await request(app)
        .get("/api/admin/collocations")
        .query({ search: "قرار" })
        .set(authHeader);
    const hiddenRow = list.body.results.find((r: any) => r.display_form === "قرار دادن");
    const visibleRow = list.body.results.find((r: any) => r.display_form === "قرار گرفتن");
    expect(hiddenRow).toBeDefined();
    expect(visibleRow).toBeDefined();
    hiddenId = hiddenRow.id;
    visibleId = visibleRow.id;

    const detail = await request(app).get(`/api/admin/collocations/${hiddenId}`).set(authHeader);
    hiddenExampleId = detail.body.examples[0].id;
    hiddenCorrectOptionId = detail.body.examples[0].options.find((o: any) => o.is_correct).id;
});

afterAll(async () => {
    await closeTestDatabase();
});

describe("public visibility floor — collocations", () => {
    it("excludes the hidden row from search, even for an exact substring match", async () => {
        const res = await request(app).get("/api/collocations/search").query({ q: "قرار" });
        expect(res.status).toBe(200);
        expect(res.body.results.some((r: any) => r.id === hiddenId)).toBe(false);
        expect(res.body.results.some((r: any) => r.id === visibleId)).toBe(true);
    });

    it("404s the detail page for the hidden row, same as a non-existent id", async () => {
        const res = await request(app).get(`/api/collocations/${hiddenId}`);
        expect(res.status).toBe(404);
    });

    it("still serves the detail page normally for a visible row", async () => {
        const res = await request(app).get(`/api/collocations/${visibleId}`);
        expect(res.status).toBe(200);
        expect(res.body.collocation.display_form).toBe("قرار گرفتن");
    });

    it("404s /related for the hidden row itself", async () => {
        const res = await request(app).get(`/api/collocations/${hiddenId}/related`);
        expect(res.status).toBe(404);
    });

    it("excludes the hidden row from another collocation's /related, despite sharing word1", async () => {
        const res = await request(app).get(`/api/collocations/${visibleId}/related`);
        expect(res.status).toBe(200);
        expect(res.body.results.some((r: any) => r.id === hiddenId)).toBe(false);
    });

    it("404s report submission for the hidden row", async () => {
        const res = await request(app)
            .post(`/api/collocations/${hiddenId}/report`)
            .send({ reason: "wrong_collocation" });
        expect(res.status).toBe(404);
    });

    it("excludes the hidden row from /browse and its category count in /patterns", async () => {
        // "NOUN+VERB" maps to the VERB_PHRASE category. Fixtures put exactly
        // two OTHER NOUN+VERB rows above the floor (collocations 1 and 3),
        // plus this one hidden one — so the visible total must be exactly 2.
        const browse = await request(app)
            .get("/api/collocations/browse")
            .query({ category: "VERB_PHRASE", limit: 50 });
        expect(browse.status).toBe(200);
        expect(browse.body.total).toBe(2);
        expect(browse.body.results.some((r: any) => r.id === hiddenId)).toBe(false);

        const patterns = await request(app).get("/api/collocations/patterns");
        const verbPhrase = patterns.body.patterns.find((p: any) => p.category === "VERB_PHRASE");
        expect(verbPhrase.count).toBe(2);
    });

    it("still shows admins the hidden row in full, unfiltered", async () => {
        const res = await request(app).get(`/api/admin/collocations/${hiddenId}`).set(authHeader);
        expect(res.status).toBe(200);
        expect(res.body.collocation.display_form).toBe("قرار دادن");
        expect(res.body.collocation.minmax_score).toBeCloseTo(0.05);
    });
});

describe("public visibility floor — exercises", () => {
    it("returns an empty exercise list for the hidden collocation (not an error)", async () => {
        const res = await request(app).get(`/api/exercises/collocation/${hiddenId}`);
        expect(res.status).toBe(200);
        expect(res.body.exercises).toEqual([]);
    });

    it("still returns exercises normally for a visible collocation", async () => {
        const res = await request(app).get(`/api/exercises/collocation/${visibleId}`);
        expect(res.status).toBe(200);
        expect(res.body.exercises.length).toBeGreaterThan(0);
    });

    it("never draws the hidden collocation's example from /random across many draws", async () => {
        for (let i = 0; i < 40; i++) {
            const res = await request(app).get("/api/exercises/random");
            expect(res.status).toBe(200);
            expect(res.body.exampleId).not.toBe(hiddenExampleId);
            expect(res.body.collocationId).not.toBe(hiddenId);
        }
    });

    it("404s answer-checking for the hidden collocation's exercise instead of leaking the answer", async () => {
        const res = await request(app)
            .post(`/api/exercises/${hiddenExampleId}/check`)
            .send({ optionId: hiddenCorrectOptionId });
        expect(res.status).toBe(404);
        expect(res.body.correctAnswer).toBeUndefined();
    });
});

describe("pattern_category_label on public responses", () => {
    it("search results show the 4-category label instead of the raw pos_pattern", async () => {
        const res = await request(app).get("/api/collocations/search").query({ q: "قرار گرفتن" });
        const row = res.body.results.find((r: any) => r.id === visibleId);
        expect(row).toBeDefined();
        expect(row.pattern_category_label).toBe("فعل‌های مرکب");
    });

    it("the collocation detail response also includes it", async () => {
        const res = await request(app).get(`/api/collocations/${visibleId}`);
        expect(res.body.collocation.pattern_category_label).toBe("فعل‌های مرکب");
    });
});
