import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Single shared connection pool for the whole app.
// DATABASE_URL example: postgres://hamvajeh:hamvajeh@localhost:5432/hamvajeh
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
    console.error("Unexpected error on idle Postgres client", err);
    process.exit(1);
});
