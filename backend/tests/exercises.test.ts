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

describe("GET /api/exercises/random", () => {
    it("returns a blank sentence with exactly 4 options and no leaked answer", async () => {
        const res = await request(app).get("/api/exercises/random");
        expect(res.status).toBe(200);
        expect(res.body.blankSentence).toContain("___________");
        expect(res.body.options).toHaveLength(4);
        // The response must never include which option is correct
        for (const option of res.body.options) {
            expect(option).not.toHaveProperty("is_correct");
            expect(option).not.toHaveProperty("isCorrect");
        }
    });
});

describe("GET /api/exercises/collocation/:collocationId", () => {
    it("returns all blank-having exercises for a collocation", async () => {
        const res = await request(app).get("/api/exercises/collocation/1");
        expect(res.status).toBe(200);
        expect(res.body.exercises).toHaveLength(2);
        for (const exercise of res.body.exercises) {
            expect(exercise.options).toHaveLength(4);
        }
    });

    it("returns an empty list for a collocation with no examples", async () => {
        const res = await request(app).get("/api/exercises/collocation/3");
        expect(res.status).toBe(200);
        expect(res.body.exercises).toEqual([]);
    });
});

describe("POST /api/exercises/:exampleId/check", () => {
    it("confirms the correct option as correct", async () => {
        const detail = await request(app).get("/api/exercises/collocation/1");
        const firstExercise = detail.body.exercises[0];
        const correctOption = firstExercise.options.find(
            (o: any) => o.text === "مورد تشویق قرار گرفت"
        );

        const res = await request(app)
            .post(`/api/exercises/${firstExercise.exampleId}/check`)
            .send({ optionId: correctOption.id });

        expect(res.status).toBe(200);
        expect(res.body.isCorrect).toBe(true);
        expect(res.body.correctAnswer).toBe("مورد تشویق قرار گرفت");
    });

    it("marks a wrong option as incorrect but still reveals the correct answer", async () => {
        const detail = await request(app).get("/api/exercises/collocation/1");
        const firstExercise = detail.body.exercises[0];
        const wrongOption = firstExercise.options.find(
            (o: any) => o.text !== "مورد تشویق قرار گرفت"
        );

        const res = await request(app)
            .post(`/api/exercises/${firstExercise.exampleId}/check`)
            .send({ optionId: wrongOption.id });

        expect(res.status).toBe(200);
        expect(res.body.isCorrect).toBe(false);
        expect(res.body.correctAnswer).toBe("مورد تشویق قرار گرفت");
    });

    it("returns 404 for a non-existent example", async () => {
        const res = await request(app).post("/api/exercises/999999/check").send({ optionId: 1 });
        expect(res.status).toBe(404);
    });

    it("returns 400 when optionId is missing or invalid", async () => {
        const res = await request(app).post("/api/exercises/1/check").send({});
        expect(res.status).toBe(400);
    });
});
