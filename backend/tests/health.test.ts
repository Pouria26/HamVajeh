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

describe("GET /health", () => {
    it("returns ok and confirms the DB connection", async () => {
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok", db: "connected" });
    });
});
