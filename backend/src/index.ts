import express from "express";
import dotenv from "dotenv";
import { pool } from "./db/pool";
import { collocationsRouter } from "./routes/collocations";
import { exercisesRouter } from "./routes/exercises";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Simple permissive CORS for local development (frontend runs on a different port via Vite)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
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

app.listen(port, () => {
    console.log(`HamVajeh backend listening on http://localhost:${port}`);
});
