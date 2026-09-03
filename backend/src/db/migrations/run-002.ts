/**
 * One-off helper: creates the `reports` table without requiring the psql
 * CLI. Run from inside backend/:
 *   npx ts-node src/db/migrations/run-002.ts
 */
import fs from "fs";
import path from "path";
import { pool } from "../pool";

async function main() {
    const sqlPath = path.join(__dirname, "002_add_reports_table.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    console.log("Running migration:", sqlPath);
    await pool.query(sql);
    console.log("Done — reports table is ready.");
    await pool.end();
}

main().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
});
