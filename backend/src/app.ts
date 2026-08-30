import express from "express";
import { pool } from "./db/pool";
import { collocationsRouter } from "./routes/collocations";
import { exercisesRouter } from "./routes/exercises";
import { adminRouter } from "./routes/admin";
import { requireAdminAuth } from "./middleware/adminAuth";

// This file only builds the app; it does not call listen(). This makes the
// app importable by the test suite (via supertest) without binding a real port.
export function createApp() {
    const app = express();

    app.use(express.json());

    // Simple permissive CORS for local development (frontend runs on a different port via Vite)
    app.use((req, res, next) => {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
        res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (req.method === "OPTIONS") {
            res.sendStatus(204);
            return;
        }
        next();
    });

    app.get("/health", async (_req, res) => {
        try {
            await pool.query("SELECT 1");
            res.json({ status: "ok", db: "connected" });
        } catch (err) {
            res.status(500).json({ status: "error", message: (err as Error).message });
        }
    });

    app.use("/api/collocations", collocationsRouter);
    app.use("/api/exercises", exercisesRouter);
    app.use("/api/admin", requireAdminAuth, adminRouter);

    return app;
}
