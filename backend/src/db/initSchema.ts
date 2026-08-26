import fs from "fs";
import path from "path";
import { pool } from "./pool";

async function main() {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    console.log("Applying schema.sql to the database...");
    await pool.query(schemaSql);
    console.log("Schema created successfully.");

    await pool.end();
}

main().catch((err) => {
    console.error("Failed to apply schema:", err);
    process.exit(1);
});
