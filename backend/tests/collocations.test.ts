import request from "supertest";
import { createApp } from "../src/app";
import { resetTestDatabase, closeTestDatabase } from "./fixtures";

const app = createApp();

beforeAll(async () => {
    await resetTestDatabase();
});

afterAll(async () => {
    await closeTestDatabase();
});

describe("GET /api/collocations/search", () => {
    it("finds a collocation by partial Persian text", async () => {
        const res = await request(app).get("/api/collocations/search").query({ q: "قرار" });
        expect(res.status).toBe(200);
        expect(res.body.results.length).toBeGreaterThan(0);
        expect(res.body.results.some((r: any) => r.display_form === "قرار گرفتن")).toBe(true);
    });

    it("returns an empty list for an empty query instead of erroring", async () => {
        const res = await request(app).get("/api/collocations/search").query({ q: "" });
        expect(res.status).toBe(200);
        expect(res.body.results).toEqual([]);
    });

    it("returns no results for a nonsense query", async () => {
        const res = await request(app).get("/api/collocations/search").query({ q: "xyzxyzxyz123" });
        expect(res.status).toBe(200);
        expect(res.body.results).toEqual([]);
    });
});

describe("GET /api/collocations/:id", () => {
    it("returns the collocation with its examples, ordered", async () => {
        const res = await request(app).get("/api/collocations/1");
        expect(res.status).toBe(200);
        expect(res.body.collocation.display_form).toBe("قرار گرفتن");
        expect(res.body.examples).toHaveLength(2);
        expect(res.body.examples[0].example_order).toBeLessThan(res.body.examples[1].example_order);
    });

    it("handles a merged-compound collocation (word2 = null) correctly", async () => {
        const res = await request(app).get("/api/collocations/2");
        expect(res.status).toBe(200);
        expect(res.body.collocation.display_form).toBe("گفتگو");
        expect(res.body.collocation.word2).toBeNull();
    });

    it("returns an empty examples array for a collocation with no examples", async () => {
        const res = await request(app).get("/api/collocations/3");
        expect(res.status).toBe(200);
        expect(res.body.examples).toEqual([]);
    });

    it("returns 404 for a non-existent id", async () => {
        const res = await request(app).get("/api/collocations/999999");
        expect(res.status).toBe(404);
    });

    it("returns 400 for a non-numeric id", async () => {
        const res = await request(app).get("/api/collocations/not-a-number");
        expect(res.status).toBe(400);
    });
});
