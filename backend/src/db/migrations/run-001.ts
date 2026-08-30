/**
 * One-off helper: applies the needs_review migration without requiring the
 * psql CLI. Run from inside backend/:
 *   npx ts-node src/db/migrations/run-001.ts
 * (or `npm run build && node dist/db/migrations/run-001.js` if you don't
 * have ts-node — either way it just runs the same ALTER TABLE statement.)
 */
import fs from "fs";
import path from "path";
import { pool } from "../pool";

async function main() {
    const sqlPath = path.join(__dirname, "001_add_needs_review.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    console.log("Running migration:", sqlPath);
    await pool.query(sql);
    console.log("Done — needs_review column is ready.");
    await pool.end();
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
