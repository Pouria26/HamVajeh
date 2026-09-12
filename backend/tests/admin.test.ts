import request from "supertest";
import { createApp } from "../src/app";
import { resetTestDatabase, closeTestDatabase } from "./fixtures";

// The admin routes read process.env.ADMIN_TOKEN per-request (not at import
// time), so setting it here before any request is made is sufficient — no
// need for a .env file or dotenv in the test environment.
const ADMIN_TOKEN = "test-admin-token";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;

const app = createApp();
const authHeader = { Authorization: `Bearer ${ADMIN_TOKEN}` };

beforeAll(async () => {
    await resetTestDatabase();
});

afterAll(async () => {
    await closeTestDatabase();
});

describe("admin auth", () => {
    it("rejects requests with no token", async () => {
        const res = await request(app).get("/api/admin/collocations");
        expect(res.status).toBe(401);
    });

    it("rejects requests with the wrong token", async () => {
        const res = await request(app)
            .get("/api/admin/collocations")
            .set("Authorization", "Bearer not-the-right-token");
        expect(res.status).toBe(401);
    });
});

describe("GET /api/admin/collocations — needs_review (\"مشکوک\") filter", () => {
    it("returns needsReviewTotal alongside results, reflecting the whole table regardless of filters", async () => {
        const res = await request(app).get("/api/admin/collocations").set(authHeader);
        expect(res.status).toBe(200);
        // 5 fixture rows total as of tests/fixtures.ts (includes collocation 5,
        // which is below the public visibility floor but still fully visible
        // to the admin panel — see tests/visibility.test.ts for that behavior).
        expect(res.body.total).toBe(5);
        expect(res.body.needsReviewTotal).toBe(1);
    });

    it("?needs_review=1 returns only the flagged row", async () => {
        const res = await request(app)
            .get("/api/admin/collocations")
            .query({ needs_review: "1" })
            .set(authHeader);
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(1);
        expect(res.body.results).toHaveLength(1);
        expect(res.body.results[0].display_form).toBe("چندی قبل");
        expect(res.body.results[0].needs_review).toBe(true);
    });

    it("status filter and needs_review filter combine with AND", async () => {
        const res = await request(app)
            .get("/api/admin/collocations")
            .query({ needs_review: "1", status: "corrected" })
            .set(authHeader);
        expect(res.status).toBe(200);
        // The only needs_review=true fixture has status='valid', not 'corrected'.
        expect(res.body.total).toBe(0);
    });
});

describe("PATCH /api/admin/collocations/:id — clearing the flag", () => {
    it("updates needs_review and is reflected in the next list call's needsReviewTotal", async () => {
        const list = await request(app).get("/api/admin/collocations").set(authHeader);
        const flagged = list.body.results.find((r: any) => r.display_form === "چندی قبل");
        expect(flagged).toBeDefined();

        const patch = await request(app)
            .patch(`/api/admin/collocations/${flagged.id}`)
            .set(authHeader)
            .send({ needs_review: false });
        expect(patch.status).toBe(200);
        expect(patch.body.collocation.needs_review).toBe(false);

        const after = await request(app).get("/api/admin/collocations").set(authHeader);
        expect(after.body.needsReviewTotal).toBe(0);

        // Restore fixture state for the tests below.
        await request(app)
            .patch(`/api/admin/collocations/${flagged.id}`)
            .set(authHeader)
            .send({ needs_review: true });
    });

    it("a partial patch (e.g. only needs_review) does not clobber other fields", async () => {
        const list = await request(app).get("/api/admin/collocations").set(authHeader);
        const row = list.body.results.find((r: any) => r.display_form === "چندی قبل");

        await request(app).patch(`/api/admin/collocations/${row.id}`).set(authHeader).send({ needs_review: true });

        const detail = await request(app).get(`/api/admin/collocations/${row.id}`).set(authHeader);
        expect(detail.body.collocation.word1).toBe("چندی");
        expect(detail.body.collocation.word2).toBe("قبل");
        expect(detail.body.collocation.status).toBe("valid");
    });
});

describe("POST /api/admin/collocations/clear-needs-review — bulk clear", () => {
    it("clears every flagged row in one call and reports the count", async () => {
        // Flag a second row too, so we can confirm this is a genuine bulk operation.
        const list = await request(app).get("/api/admin/collocations").set(authHeader);
        const target = list.body.results.find((r: any) => r.display_form === "گفتگو");
        const flagged = list.body.results.find((r: any) => r.display_form === "چندی قبل");
        await request(app).patch(`/api/admin/collocations/${target.id}`).set(authHeader).send({ needs_review: true });

        const before = await request(app).get("/api/admin/collocations").set(authHeader);
        expect(before.body.needsReviewTotal).toBe(2);

        const res = await request(app).post("/api/admin/collocations/clear-needs-review").set(authHeader);
        expect(res.status).toBe(200);
        expect(res.body.cleared).toBe(2);

        const after = await request(app).get("/api/admin/collocations").set(authHeader);
        expect(after.body.needsReviewTotal).toBe(0);

        // Restore fixture state for any tests that run after this one (in
        // particular the CSV export test below expects pair_id=4 to still
        // be flagged, matching the original fixture data).
        await request(app)
            .patch(`/api/admin/collocations/${target.id}`)
            .set(authHeader)
            .send({ needs_review: false });
        await request(app)
            .patch(`/api/admin/collocations/${flagged.id}`)
            .set(authHeader)
            .send({ needs_review: true });
    });
});

describe("GET /api/admin/export/csv — round-trip fields", () => {
    it("includes display_form, reason (correction_note), and needs_review as real columns", async () => {
        // Query current live state first rather than assuming a specific
        // needs_review value, so this test doesn't depend on execution
        // order relative to the mutating tests above.
        const list = await request(app).get("/api/admin/collocations").set(authHeader);
        const liveRow4 = list.body.results.find((r: any) => r.pair_id === "4" || r.pair_id === 4);
        expect(liveRow4).toBeDefined();

        const res = await request(app).get("/api/admin/export/csv").set(authHeader);
        expect(res.status).toBe(200);

        const csvText = res.text.replace(/^\uFEFF/, "");
        const [headerLine, ...dataLines] = csvText.trim().split(/\r?\n/);
        const headers = headerLine.split(",");

        expect(headers).toContain("display_form");
        expect(headers).toContain("reason");
        expect(headers).toContain("needs_review");

        const pairIdIdx = headers.indexOf("pair_id");
        const displayFormIdx = headers.indexOf("display_form");
        const needsReviewIdx = headers.indexOf("needs_review");
        const reasonIdx = headers.indexOf("reason");

        const row4 = dataLines.map((l) => l.split(",")).find((cols) => cols[pairIdIdx] === "4");
        expect(row4).toBeDefined();
        expect(row4![displayFormIdx]).toBe("چندی قبل");
        expect(row4![needsReviewIdx]).toBe(liveRow4.needs_review ? "1" : "0");

        const row2 = dataLines.map((l) => l.split(",")).find((cols) => cols[pairIdIdx] === "2");
        expect(row2).toBeDefined();
        expect(row2![reasonIdx]).toBe("merged compound");
    });
});
