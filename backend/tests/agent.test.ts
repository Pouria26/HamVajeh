import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("Agent Gateway Router (/api/agent)", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    describe("Validation on POST /api/agent/chat", () => {
        it("rejects request with missing message", async () => {
            const res = await request(app).post("/api/agent/chat").send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toBe("missing_message");
        });

        it("rejects request with empty message", async () => {
            const res = await request(app).post("/api/agent/chat").send({ message: "   " });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe("invalid_message");
        });

        it("rejects request with invalid history role", async () => {
            const res = await request(app)
                .post("/api/agent/chat")
                .send({
                    message: "سلام",
                    history: [{ role: "system_admin", content: "test" }],
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe("invalid_role");
        });

        it("rejects request with empty history content", async () => {
            const res = await request(app)
                .post("/api/agent/chat")
                .send({
                    message: "سلام",
                    history: [{ role: "user", content: "" }],
                });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe("invalid_history");
        });
    });

    describe("Validation on POST /api/agent/explain", () => {
        it("rejects request with missing example_id", async () => {
            const res = await request(app).post("/api/agent/explain").send({
                selected_option_id: 2,
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe("invalid_example_id");
        });

        it("rejects request with non-positive selected_option_id", async () => {
            const res = await request(app).post("/api/agent/explain").send({
                example_id: 1,
                selected_option_id: 0,
            });
            expect(res.status).toBe(400);
            expect(res.body.error).toBe("invalid_selected_option_id");
        });
    });

    describe("Graceful offline degradation (when Python agent is down)", () => {
        beforeEach(() => {
            // Mock fetch to simulate network connection failure (ECONNREFUSED)
            global.fetch = jest.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:8001"));
        });

        it("returns HTTP 503 with polite Persian error message for /chat", async () => {
            const res = await request(app).post("/api/agent/chat").send({
                message: "آیا تصمیم گرفتن یک باهم‌آیی است؟",
            });
            expect(res.status).toBe(503);
            expect(res.body.error).toBe("agent_service_unavailable");
            expect(res.body.message).toContain("سرویس دستیار هوشمند در حال حاضر در دسترس نیست");
        });

        it("returns HTTP 503 with polite Persian error message for /explain", async () => {
            const res = await request(app).post("/api/agent/explain").send({
                example_id: 1,
                selected_option_id: 2,
            });
            expect(res.status).toBe(503);
            expect(res.body.error).toBe("agent_service_unavailable");
            expect(res.body.message).toContain("سرویس دستیار هوشمند در حال حاضر در دسترس نیست");
        });

        it("returns HTTP 503 with degraded status for /health", async () => {
            const res = await request(app).get("/api/agent/health");
            expect(res.status).toBe(503);
            expect(res.body.status).toBe("degraded");
            expect(res.body.agent_service).toBe("unreachable");
        });
    });

    describe("Successful proxy forwarding", () => {
        it("proxies /chat response cleanly when agent returns 200 OK", async () => {
            const mockAgentResponse = {
                reply: "بله، «تصمیم گرفتن» یک باهم‌آیی اصیل و پرکاربرد در زبان فارسی است.",
                suggested_followups: ["تفاوت آن با اتخاذ تصمیم چیست؟"],
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: {
                    get: (header: string) => (header.toLowerCase() === "content-type" ? "application/json" : null),
                },
                json: async () => mockAgentResponse,
            } as unknown as Response);

            const res = await request(app).post("/api/agent/chat").send({
                message: "آیا تصمیم گرفتن باهم‌آیی است؟",
            });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockAgentResponse);
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it("proxies /explain judgment cleanly when agent returns 200 OK", async () => {
            const mockJudgment = {
                agrees_with_database: "agree",
                confidence: "high",
                linguistic_reasoning: "بودجه جاری اصطلاحی اقتصادی است و نمی‌تواند جایگاه فعل را پر کند.",
                user_facing_answer: "عبارت «بودجه جاری» از نظر ساختار دستوری با این جمله هم‌خوانی ندارد.",
                flag_for_review: false,
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: {
                    get: (header: string) => (header.toLowerCase() === "content-type" ? "application/json" : null),
                },
                json: async () => mockJudgment,
            } as unknown as Response);

            const res = await request(app).post("/api/agent/explain").send({
                example_id: 1,
                selected_option_id: 2,
            });

            expect(res.status).toBe(200);
            expect(res.body).toEqual(mockJudgment);
        });

        it("returns 200 with agent metrics on /health", async () => {
            const mockHealthData = {
                status: "ok",
                service: "hamvajeh-agent",
                flags_logged_today: 3,
            };

            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                headers: {
                    get: (header: string) => (header.toLowerCase() === "content-type" ? "application/json" : null),
                },
                json: async () => mockHealthData,
            } as unknown as Response);

            const res = await request(app).get("/api/agent/health");

            expect(res.status).toBe(200);
            expect(res.body.status).toBe("ok");
            expect(res.body.agent_service).toBe("connected");
            expect(res.body.metrics).toEqual(mockHealthData);
        });
    });
});
