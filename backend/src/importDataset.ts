/**
 * Usage:
 *   npm run import-csv -- --input ../final_df.csv
 *
 * Assumes the schema has already been created via `npm run init-schema`.
 * This script TRUNCATEs the tables first, so it is safe to re-run.
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { pool } from "./db/pool";
import { CsvRow } from "./types";

function getArg(name: string, fallback: string): string {
    const idx = process.argv.indexOf(`--${name}`);
    if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
    return fallback;
}

function toNullableFloat(v: string | undefined): number | null {
    if (v === undefined || v === null) return null;
    const trimmed = v.trim();
    if (trimmed === "" || trimmed.toLowerCase() === "nan") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}

function buildDisplayForm(word1: string, word2: string | null): string {
    const w1 = (word1 || "").trim();
    const w2 = (word2 || "").trim();
    // If word2 is empty, word1_final already holds the fully merged form (e.g. "گفت‌وگو")
    if (!w2) return w1;
    return `${w1} ${w2}`;
}

async function main() {
    const inputPath = path.resolve(getArg("input", path.join(__dirname, "..", "final_df.csv")));

    if (!fs.existsSync(inputPath)) {
        console.error(`File not found: ${inputPath}`);
        console.error(`Pass the correct path with --input, e.g. npm run import-csv -- --input ../final_df.csv`);
        process.exit(1);
    }

    console.log(`Reading file: ${inputPath}`);
    const rawContent = fs.readFileSync(inputPath, "utf-8");

    const records: CsvRow[] = parse(rawContent, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
    });

    console.log(`Rows read from CSV: ${records.length}`);

    const client = await pool.connect();

    let insertedCollocations = 0;
    let insertedExamples = 0;
    let insertedOptions = 0;
    let skippedInvalid = 0;
    let skippedDuplicateOrEmptyPairId = 0;
    let skippedBadJson = 0;

    const seenPairIds = new Set<string>();

    try {
        await client.query("BEGIN");

        // Re-runnable: clear existing data before loading (also resets identity sequences)
        await client.query("TRUNCATE exercise_options, examples, collocations RESTART IDENTITY CASCADE");

        for (const row of records) {
            const status = (row.status || "").trim();

            if (status === "invalid") {
                skippedInvalid++;
                continue;
            }
            if (status !== "valid" && status !== "corrected") {
                continue;
            }

            const pairId = (row.pair_id || "").trim();
            if (!pairId || seenPairIds.has(pairId)) {
                skippedDuplicateOrEmptyPairId++;
                continue;
            }
            seenPairIds.add(pairId);

            const word1 = (row.word1_final || row.word1_orig || "").trim();
            const word2raw = (row.word2_final || "").trim();
            const word2 = word2raw === "" ? null : word2raw;
            const displayForm = buildDisplayForm(word1, word2);

            const collocationInsert = await client.query<{ id: number }>(
                `INSERT INTO collocations
                    (pair_id, word1, word2, display_form, pos_pattern, status, correction_note,
                     pmi, t_score, llr, logdice, combined_score, minmax_score)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                 RETURNING id`,
                [
                    Number(pairId),
                    word1,
                    word2,
                    displayForm,
                    row.pos_pattern || null,
                    status,
                    row.reason || null,
                    toNullableFloat(row.pmi),
                    toNullableFloat(row.t_score),
                    toNullableFloat(row.llr),
                    toNullableFloat(row.logdice),
                    toNullableFloat(row.combined_score),
                    toNullableFloat(row.minmax_score),
                ]
            );

            const collocationId = collocationInsert.rows[0].id;
            insertedCollocations++;

            for (let i = 1; i <= 5; i++) {
                const sentence = (row[`sentence_${i}`] || "").trim();
                if (!sentence) continue;

                const blankSentence = (row[`blank_${i}`] || "").trim() || null;
                const answerRaw = (row[`answer_blank_${i}`] || "").trim();

                let options: string[] = [];
                if (answerRaw) {
                    try {
                        const parsed = JSON.parse(answerRaw);
                        if (Array.isArray(parsed)) options = parsed.map((x) => String(x).trim());
                    } catch {
                        skippedBadJson++;
                    }
                }

                const targetPhrase = options.length > 0 ? options[0] : null;

                const exampleInsert = await client.query<{ id: number }>(
                    `INSERT INTO examples (collocation_id, sentence, blank_sentence, target_phrase, example_order)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id`,
                    [collocationId, sentence, blankSentence, targetPhrase, i]
                );
                const exampleId = exampleInsert.rows[0].id;
                insertedExamples++;

                for (let idx = 0; idx < options.length; idx++) {
                    await client.query(
                        `INSERT INTO exercise_options (example_id, option_text, option_order, is_correct)
                         VALUES ($1, $2, $3, $4)`,
                        [exampleId, options[idx], idx + 1, idx === 0]
                    );
                    insertedOptions++;
                }
            }
        }

        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }

    console.log("\n==================== Import summary ====================");
    console.log(`Collocations inserted:        ${insertedCollocations}`);
    console.log(`Examples/exercises inserted:  ${insertedExamples}`);
    console.log(`Options inserted:              ${insertedOptions}`);
    console.log(`Skipped (invalid status):      ${skippedInvalid}`);
    console.log(`Skipped (duplicate/empty pair_id): ${skippedDuplicateOrEmptyPairId}`);
    console.log(`Skipped (malformed answer JSON):   ${skippedBadJson}`);

    await pool.end();
}

main().catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
});
