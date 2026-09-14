import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pool } from "./db/pool";
import { collocationsRouter } from "./routes/collocations";
import { exercisesRouter } from "./routes/exercises";
import { adminRouter } from "./routes/admin";
import { agentRouter } from "./routes/agent";
import { requireAdminAuth } from "./middleware/adminAuth";

// This file only builds the app; it does not call listen(). This makes the
// app importable by the test suite (via supertest) without binding a real port.
export function createApp() {
    const app = express();

    // Trust first hop reverse proxy (Nginx) for client IP detection in rate limiters
    app.set("trust proxy", 1);

    app.use(express.json({ limit: "50kb" }));
    app.use(helmet());

    // CORS: restrict origin to the frontend URL in production; fall back to
    // permissive "*" only in local development.
    const allowedOrigin = process.env.FRONTEND_URL || "*";
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", allowedOrigin);
        res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") {
            res.sendStatus(204);
            return;
        }
        next();
    });

    const isTestEnv = process.env.NODE_ENV === "test";

    // General rate limiter for all /api endpoints
    const globalApiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 600,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isTestEnv,
        message: { error: "rate_limit_exceeded", message: "Too many requests, please try again later." },
    });

    // Stricter limiter on fuzzy search to prevent expensive trigram scan abuse
    const searchLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 60,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isTestEnv,
        message: { error: "rate_limit_exceeded", message: "Too many search queries, please slow down." },
    });

    // Anti-spam limiter on crowdsourced report submissions
    const reportLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 15,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isTestEnv,
        message: { error: "rate_limit_exceeded", message: "Too many reports submitted, please try again later." },
    });

    // Rate limiter for AI agent endpoints (protects LLM quota & prevents abuse)
    const agentLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isTestEnv,
        message: {
            error: "rate_limit_exceeded",
            message: "تعداد درخواست‌های ارسالی به دستیار بیش از حد مجاز است. لطفاً کمی بعد دوباره امتحان کنید.",
        },
    });

    app.get("/health", async (_req, res) => {
        try {
            await pool.query("SELECT 1");
            res.json({ status: "ok", db: "connected" });
        } catch (err) {
            res.status(500).json({ status: "error", message: (err as Error).message });
        }
    });

    app.use("/api", globalApiLimiter);
    app.use("/api/collocations/search", searchLimiter);
    app.use("/api/collocations/:id/report", reportLimiter);

    app.use("/api/collocations", collocationsRouter);
    app.use("/api/exercises", exercisesRouter);
    app.use("/api/admin", requireAdminAuth, adminRouter);
    app.use("/api/agent", agentLimiter, agentRouter);

    return app;
}
