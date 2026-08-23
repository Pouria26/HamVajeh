# -*- coding: utf-8 -*-
"""
Merge output files from different shards (each processed with a separate API key)
into a single final file, final_df.csv.

Usage:
    python merge_shards.py --inputs batch1_part0.csv batch1_part1.csv --output final_df.csv
"""
import argparse
import pandas as pd


def main():
    parser = argparse.ArgumentParser(
        description="Merge multiple shard CSV files (each produced by a separate "
                     "parallel run of build_final_dataset.py) into one final CSV, "
                     "removing any duplicate rows and sorting the result by pair_id."
    )
    parser.add_argument(
        "--inputs", nargs="+", required=True,
        help="List of shard CSV files to merge (space-separated), "
             "e.g. --inputs batch1_part0.csv batch1_part1.csv"
    )
    parser.add_argument(
        "--output", required=True,
        help="Path to write the merged output CSV file to, e.g. final_df.csv"
    )
    args = parser.parse_args()

    dfs = []
    for path in args.inputs:
        df = pd.read_csv(path)
        print(f"{path}: {len(df)} rows")
        dfs.append(df)

    merged = pd.concat(dfs, ignore_index=True)
    before = len(merged)
    merged = merged.drop_duplicates(subset=["pair_id"], keep="first")
    after = len(merged)
    if before != after:
        print(f"Warning: removed {before - after} duplicate rows (pair_id shared across shards).")

    merged = merged.sort_values("pair_id").reset_index(drop=True)
    merged.to_csv(args.output, index=False, encoding="utf-8-sig")
    print(f"Saved: {args.output} ({len(merged)} rows)")


if __name__ == "__main__":
    main()
