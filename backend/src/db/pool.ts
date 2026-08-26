import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Jest sets NODE_ENV=test automatically, so the test suite talks to a
// separate database (TEST_DATABASE_URL) and never touches dev/prod data.
const connectionString =
    process.env.NODE_ENV === "test" ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

export const pool = new Pool({ connectionString });

pool.on("error", (err) => {
    console.error("Unexpected error on idle Postgres client", err);
    process.exit(1);
});
