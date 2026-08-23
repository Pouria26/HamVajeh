# -*- coding: utf-8 -*-
"""
Pipeline for building the final Persian collocation dataset.
- Input: best_df_minmax.parquet (~5000 rows)
- Output: final_df.csv (written incrementally, row by row)

Features:
1. Automatic resume: if the script is interrupted, re-running it picks up
   right where it left off (based on the pair_id values already present in
   final_df.csv).
2. Row-by-row writing with an immediate flush -> no data is lost on a crash.
3. Rate limiting + exponential backoff retry to avoid 429 errors / network drops.
4. Structured (JSON) output from the model: collocation validation/correction
   plus generation of high-quality example sentences.
5. Correction is preferred over deletion; rows are only dropped/flagged as
   invalid when the collocation is genuinely not valid.

Usage:
    export OPENROUTER_API_KEY="sk-or-..."
    python3 build_final_dataset.py --input best_df_minmax.parquet --output final_df.csv

    # To test on a small number of rows:
    python3 build_final_dataset.py --input best_df_minmax.parquet --output test_out.csv --limit 10

    # If the exact name of the free model on OpenRouter has changed:
    python3 build_final_dataset.py --model "openrouter/optimus-alpha" ...
"""

import os
import sys
import csv
import json
import time
import argparse
import random
import pandas as pd
import requests

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Note: the exact names of free "stealth" models on OpenRouter change over time.
# Before running, check https://openrouter.ai/models?max_price=0 to confirm this
# model id is still active and free; otherwise pass the correct name via --model.
DEFAULT_MODEL = "stealth/ox-alpha"

SYSTEM_PROMPT = """تو یک زبان‌شناس متخصص زبان فارسی هستی که به یک پروژه‌ی دانشگاهی
برای ساخت دیتاست آموزش باهم‌آیی (collocation) فارسی به غیرفارسی‌زبانان کمک می‌کنی.

به تو یک جفت واژه (که به‌صورت خودکار و آماری از یک پیکره استخراج شده) و چند جمله‌ی
واقعی از همان پیکره که این دو واژه در کنار هم در آن‌ها ظاهر شده‌اند، داده می‌شود.

وظیفه‌ی تو:
1. با نگاه‌کردن به جمله‌های واقعی، تشخیص بده باهم‌آیی استخراج‌شده درست است یا خیر.
   خطاهای رایج استخراج خودکار که باید تشخیص و اصلاح بدهی:
   - واژه‌ی ناقص/شکسته‌شده (مثلا "ریز" به‌جای "ریزی" در "برنامه‌ریزی"،
     یا "الملل" به‌جای بخشی از "بین‌الملل")
   - ترتیب یا صرف نادرست
   - دو واژه‌ای که در متن واقعی کنار هم نیستند یا فقط تصادفا در یک جمله آمده‌اند
     ولی باهم‌آیی معنادار نیستند (مثلا صفت رایج + اسم خاص بدون رابطه‌ی ثابت زبانی)
2. اگر باهم‌آیی با کمی اصلاح (مثلا کامل‌کردن یک واژه‌ی ناقص) درست می‌شود، آن را اصلاح کن
   و status را "corrected" بگذار. ترجیح همیشه با اصلاح است، نه حذف.
3. فقط اگر واقعاً باهم‌آیی معناداری در کار نیست (نویز آماری محض)، status را "invalid" بگذار.
   در حالت invalid، آرایه‌ی sentences را خالی بگذار.
4. اگر status برابر "valid" یا "corrected" بود، دقیقاً ۵ جمله‌ی آموزشی متفاوت از هم
   برای باهم‌آیی نهایی بساز:
   - ۳ جمله‌ی کوتاه (حداکثر ۱۲ کلمه)
   - ۲ جمله‌ی طولانی‌تر و کمی پیچیده‌تر (بین ۱۸ تا ۲۵ کلمه)، مثلا با یک جمله‌ی پیرو
     یا یک بند توضیحی اضافه، اما هنوز روان و قابل‌فهم برای زبان‌آموز
   - همگی از نظر موضوع و ساختار با هم متفاوت باشند (تکراری یا شبیه هم نباشند)
   - هیچ‌کدام عیناً از جمله‌های نمونه‌ی پیکره کپی نشده باشند (فقط الهام بگیر، رونویسی نکن)
   - طبیعی، روان، و از نظر دستوری کاملا درست باشند
   - سطح زبانی B1-B2 برای زبان‌آموز غیرفارسی‌زبان داشته باشند
   - بدون اسم خاص (کشور/شهر/شخص/سازمان)، بدون عدد پیچیده، بدون ابهام باشند
   - باهم‌آیی هدف را طبیعی و به‌وضوح به‌کار ببرند، طوری‌که با حذف آن جمله بی‌معنی شود

5. برای هر جمله، علاوه بر خود متن، دقیقاً همان تکه‌ای از جمله که باید برای تمرین
   جای‌خالی حذف شود را هم برگردان (target_span). این باید عینا و کلمه‌به‌کلمه همان
   شکلی باشد که در جمله نوشته‌ای (با همان صرف فعل/پسوند)، نه شکل مصدری یا پایه‌ی کلمه.
   مثلا اگر جمله «او مورد تشویق قرار گرفت.» است و باهم‌آیی هدف «قرار گرفتن» است،
   target_span باید دقیقا رشته‌ی «قرار گرفت» باشد (چون این شکلی است که واقعا در جمله آمده)،
   نه «قرار گرفتن». target_span باید عینا substring دقیقی از sentence باشد، وگرنه بی‌فایده است.

نکته‌ی مهم: تو فقط مسئول تشخیص/اصلاح باهم‌آیی و تولید جمله هستی. هیچ عدد یا امتیاز
آماری (مثل PMI, logdice و...) را در خروجی برنگردان؛ آن‌ها جدا محاسبه می‌شوند.

خروجی را دقیقا و فقط به‌صورت یک JSON معتبر با این ساختار بده، بدون هیچ متن اضافه:

{
  "status": "valid" | "corrected" | "invalid",
  "word1_final": "...",
  "word2_final": "...",
  "reason": "توضیح خیلی کوتاه فارسی (یک جمله) درباره تصمیمت",
  "sentences": [
    {"sentence": "جمله ۱ (کوتاه)", "target_span": "..."},
    {"sentence": "جمله ۲ (کوتاه)", "target_span": "..."},
    {"sentence": "جمله ۳ (کوتاه)", "target_span": "..."},
    {"sentence": "جمله ۴ (طولانی‌تر)", "target_span": "..."},
    {"sentence": "جمله ۵ (طولانی‌تر)", "target_span": "..."}
  ]
}

اگر status برابر "invalid" بود: "sentences": []
"""

USER_TEMPLATE = """جفت واژه‌ی استخراج‌شده: "{word1}" + "{word2}"
الگوی نحوی: {pos_pattern}

جمله‌های واقعی از پیکره:
{examples}

طبق دستورالعمل، فقط JSON خروجی بده."""


def build_examples_block(row) -> str:
    lines = []
    for i in range(1, 6):
        ex = row.get(f"example_{i}")
        if ex is not None and str(ex) != "nan" and str(ex).strip():
            lines.append(f"- {ex}")
    if not lines:
        return "(جمله‌ی نمونه‌ای در پیکره ثبت نشده)"
    return "\n".join(lines)


def call_llm(api_key: str, model: str, word1: str, word2: str, pos_pattern: str,
             examples_block: str, max_retries: int = 6) -> dict:
    """Sends one row to the model; on a rate-limit/network error, retries with
    exponential backoff."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": USER_TEMPLATE.format(
            word1=word1, word2=word2, pos_pattern=pos_pattern, examples=examples_block
        )},
    ]

    delay = 2.0
    last_err = None
    for attempt in range(max_retries):
        # From the second attempt onward, drop response_format: some free models
        # either return empty output or an internal error when it's set.
        use_json_mode = (attempt == 0)
        # The more attempts fail, the larger the token budget we allow, and we
        # fully disable reasoning (some models produce no reasoning at all when
        # exclude=true is set).
        token_budget = 2500 if attempt < 2 else 4000
        reasoning_cfg = {"effort": "low"} if attempt < 3 else {"exclude": True}

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.4,
            "max_tokens": token_budget,
            "reasoning": reasoning_cfg,
        }
        if use_json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            resp = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=45)

            if resp.status_code == 429:
                wait = delay + random.uniform(0, 1.5)
                print(f"    [rate-limit] waiting {wait:.1f}s...")
                time.sleep(wait)
                delay *= 2
                continue

            resp.raise_for_status()
            data = resp.json()

            # If OpenRouter itself returned an error (HTTP 200 but an "error" field)
            if "error" in data:
                last_err = f"api error: {data['error']}"
                print(f"    [API error: {data['error']}] attempt {attempt+1}/{max_retries}")
                wait = delay + random.uniform(0, 1.5)
                time.sleep(wait)
                delay *= 2
                continue

            choice = data.get("choices", [{}])[0]
            message = choice.get("message", {})
            content = message.get("content")

            if not content:
                # Some models send reasoning separately or return empty content
                content = message.get("reasoning") or ""
                finish_reason = choice.get("finish_reason", "?")
                print(f"    [empty response from model, finish_reason={finish_reason}] "
                      f"raw={json.dumps(data)[:300]}")
                last_err = f"empty content (finish_reason={finish_reason})"
                if not content:
                    wait = delay + random.uniform(0, 1.5)
                    time.sleep(wait)
                    delay *= 2
                    continue

            content = content.strip()

            # Some models may wrap the output in ```json ... ```; strip that out
            if content.startswith("```"):
                content = content.strip("`")
                if content.lower().startswith("json"):
                    content = content[4:]
                content = content.strip()

            # If there was extra text before/after the JSON, extract just the { ... } part
            start = content.find("{")
            end = content.rfind("}")
            if start != -1 and end != -1 and end > start:
                content = content[start:end + 1]

            parsed = json.loads(content)
            return parsed

        except (requests.exceptions.RequestException, json.JSONDecodeError, KeyError) as e:
            last_err = e
            wait = delay + random.uniform(0, 1.5)
            print(f"    [error: {e}] attempt {attempt+1}/{max_retries}, waiting {wait:.1f}s...")
            time.sleep(wait)
            delay *= 2

    raise RuntimeError(f"Failed after {max_retries} attempts: {last_err}")


def make_blank_exercise(sentence: str, target_span: str, word1: str, word2: str):
    """Builds the fill-in-the-blank exercise. First tries using the target_span
    provided by the model itself (since it knows the exact inflected form), and
    falls back to the older method (direct word1/word2 matching) if that span
    is missing or doesn't match."""
    if not sentence:
        return None

    if target_span and target_span.strip() and target_span.strip() in sentence:
        return sentence.replace(target_span.strip(), "___________")

    # fallback: direct matching of the two words (for cases where the model's
    # target_span wasn't accurate)
    for collocation in (f"{word1} {word2}", f"{word2} {word1}"):
        if collocation in sentence:
            return sentence.replace(collocation, "___________")
    if word1 in sentence and word2 in sentence:
        return sentence.replace(word2, "___________", 1)
    return None


def load_done_ids(output_path: str) -> set:
    """Returns the pair_id values that have already been processed and saved
    (used for resuming)."""
    if not os.path.exists(output_path):
        return set()
    try:
        df_done = pd.read_csv(output_path)
        return set(df_done["pair_id"].tolist())
    except Exception:
        return set()


# Statistical metrics that are copied only and directly from the input dataset;
# the model never generates these.
STAT_COLUMNS = ["pmi", "t_score", "llr", "logdice", "combined_score", "minmax_score"]

CSV_FIELDS = (
    ["pair_id", "word1_orig", "word2_orig", "pos_pattern",
     "status", "word1_final", "word2_final", "reason"]
    + STAT_COLUMNS
    + ["sentence_1", "blank_1", "answer_blank_1",
       "sentence_2", "blank_2", "answer_blank_2",
       "sentence_3", "blank_3", "answer_blank_3",
       "sentence_4", "blank_4", "answer_blank_4",
       "sentence_5", "blank_5", "answer_blank_5"]
)


# =====================================================================
# "Blank Builder Tool"
# Responsible for building the 4-way answer options (1 correct + 3 wrong) for
# each blank, entirely rule-based and without needing a language model.
# =====================================================================

def build_distractor_pools(full_df: pd.DataFrame) -> dict:
    """Builds, from the full input dataset, a pool of unique word2 values for
    each pos_pattern. This pool is the source of wrong-answer distractors."""
    pools = {}
    for pos_pattern, group in full_df.groupby("pos_pattern"):
        vals = sorted(set(str(v).strip() for v in group["word2"].dropna().tolist() if str(v).strip()))
        pools[pos_pattern] = vals
    pools["__global__"] = sorted(set(str(v).strip() for v in full_df["word2"].dropna().tolist() if str(v).strip()))
    return pools


def build_answer_options(correct: str, pos_pattern: str, pools: dict, rng: random.Random,
                          n_distractors: int = 3, max_tries: int = 30):
    """Blank builder tool: returns a 4-item list where slot 0 is always the
    correct answer, and the next 3 slots are wrong answers, all distinct from
    each other and from the correct answer."""
    correct_norm = correct.strip()
    candidates = pools.get(pos_pattern, [])
    if len(candidates) < n_distractors + 1:
        candidates = candidates + pools.get("__global__", [])

    # remove the correct answer itself from the candidates (case/space-insensitive)
    candidates = [c for c in candidates if c.strip() != correct_norm]
    candidates = list(dict.fromkeys(candidates))  # dedupe while preserving order
    rng.shuffle(candidates)

    distractors = []
    for c in candidates:
        if len(distractors) >= n_distractors:
            break
        distractors.append(c)

    # if still short (very small corpus), pad with synthetic suffixes to reach
    # at least 4 values
    filler_idx = 1
    while len(distractors) < n_distractors:
        filler = f"{correct_norm}_option{filler_idx}"
        if filler not in distractors and filler != correct_norm:
            distractors.append(filler)
        filler_idx += 1

    return [correct_norm] + distractors[:n_distractors]


def verify_answer_options(options) -> tuple:
    """Verification tool: checks that slot 0 is present and the rest are
    distinct/non-empty. Returns: (ok: bool, reason: str)"""
    if not isinstance(options, list) or len(options) != 4:
        return False, f"list length must be 4, but is {len(options) if isinstance(options, list) else type(options)}"
    if any(not str(o).strip() for o in options):
        return False, "one of the options is empty"
    if len(set(o.strip() for o in options)) != 4:
        return False, "options are duplicated (all 4 must be distinct)"
    # We can't check the "semantic correctness" of slot 0 here (since we built
    # it ourselves from `correct`), but we do make sure slot 0 is exactly what
    # it was supposed to be; that check happens at the call site (where
    # `correct` is available).
    return True, "ok"


def verify_answer_options_full(options, expected_correct: str) -> tuple:
    """Full verification: checks both the structure and that slot 0 really is
    the expected correct answer."""
    ok, reason = verify_answer_options(options)
    if not ok:
        return ok, reason
    if options[0].strip() != expected_correct.strip():
        return False, "slot 0 does not match the expected correct answer"
    return True, "ok"


def verify_output_file(output_path: str):
    """Verifies the entire final_df.csv file without calling the API: for each
    answer_blank_i column, checks that the structure (4 values, all distinct)
    is valid."""
    if not os.path.exists(output_path):
        print(f"File not found: {output_path}")
        return

    df = pd.read_csv(output_path)
    total_checked = 0
    total_bad = 0
    bad_rows = []

    answer_cols = [c for c in df.columns if c.startswith("answer_blank_")]
    for idx, row in df.iterrows():
        for col in answer_cols:
            raw = row.get(col)
            if pd.isna(raw) or not str(raw).strip():
                continue
            total_checked += 1
            try:
                options = json.loads(raw)
            except json.JSONDecodeError:
                total_bad += 1
                bad_rows.append((row["pair_id"], col, "invalid JSON"))
                continue
            ok, reason = verify_answer_options(options)
            if not ok:
                total_bad += 1
                bad_rows.append((row["pair_id"], col, reason))

    print(f"Verification complete: {total_checked} items checked, {total_bad} had issues.")
    if bad_rows:
        print("Sample of problematic items (up to 20):")
        for pair_id, col, reason in bad_rows[:20]:
            print(f"  pair_id={pair_id}  {col}: {reason}")


def main():
    parser = argparse.ArgumentParser(
        description="Build the final Persian collocation dataset by sending each "
                     "word-pair row (with its corpus example sentences) to an LLM "
                     "over the OpenRouter API. The model validates/corrects each "
                     "collocation and generates 5 training sentences with a "
                     "fill-in-the-blank exercise and 4 answer options for each. "
                     "Results are written incrementally to a CSV file, and the "
                     "script can be safely interrupted and re-run to resume where "
                     "it left off. It also supports running multiple parallel "
                     "shards (e.g. one process per API key) via --shard-count/"
                     "--shard-index, and a --verify-only mode to sanity-check an "
                     "existing output file without calling the API."
    )
    parser.add_argument(
        "--input", required=True,
        help="Path to the input .parquet file containing the word pairs to "
             "process (e.g. best_df_minmax.parquet)."
    )
    parser.add_argument(
        "--output", default="final_df.csv",
        help="Path to the output CSV file. Rows are appended incrementally; if "
             "the file already exists, already-processed pair_ids are skipped "
             "and the run resumes automatically. Default: final_df.csv"
    )
    parser.add_argument(
        "--model", default=DEFAULT_MODEL,
        help=f"OpenRouter model id to use for generation. Default: {DEFAULT_MODEL} "
             "(check https://openrouter.ai/models?max_price=0 if this free model "
             "is no longer available)."
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Only process this many rows (useful for a quick test run instead "
             "of the full dataset)."
    )
    parser.add_argument(
        "--sleep", type=float, default=2.5,
        help="Base delay in seconds between requests, to stay within the free-"
             "tier rate limit. A small random jitter is added on top of this. "
             "Default: 2.5"
    )
    parser.add_argument(
        "--verify-only", action="store_true",
        help="Skip all API calls and just validate the existing --output file: "
             "checks that each answer_blank_i column has 4 distinct, non-empty "
             "options."
    )
    parser.add_argument(
        "--seed", type=int, default=42,
        help="Random seed used when picking wrong-answer distractor options. "
             "Default: 42"
    )
    parser.add_argument(
        "--api-key", default=None,
        help="OpenRouter API key to use directly. If omitted, the "
             "OPENROUTER_API_KEY environment variable is used instead. Useful "
             "for running multiple shards in parallel with different keys."
    )
    parser.add_argument(
        "--shard-count", type=int, default=1,
        help="Total number of shards for parallel processing (e.g. 2 to run two "
             "instances at once, each with its own API key). Default: 1 "
             "(no sharding)."
    )
    parser.add_argument(
        "--shard-index", type=int, default=0,
        help="Which shard this run should process (0-based; must be less than "
             "--shard-count). Default: 0"
    )
    args = parser.parse_args()

    if args.verify_only:
        verify_output_file(args.output)
        return

    api_key = args.api_key or os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        print("Error: neither --api-key was given nor is the OPENROUTER_API_KEY environment variable set.")
        sys.exit(1)

    if args.shard_count < 1 or not (0 <= args.shard_index < args.shard_count):
        print("Error: shard-index must be between 0 and shard-count-1.")
        sys.exit(1)

    df = pd.read_parquet(args.input)
    distractor_pools = build_distractor_pools(df)  # distractor pool built from the full dataset (before sharding)
    rng = random.Random(args.seed + args.shard_index)  # different seed per shard so choices don't match

    if args.shard_count > 1:
        n_total = len(df)
        chunk_size = -(-n_total // args.shard_count)  # ceiling division: earlier shards full-size, last one smaller
        start = args.shard_index * chunk_size
        end = min(n_total, start + chunk_size)
        df = df.iloc[start:end].copy()
        print(f"Parallel mode (contiguous): shard {args.shard_index} of {args.shard_count} "
              f"-> rows [{start}:{end}) -> {len(df)} rows assigned to this run.")

    if args.limit:
        df = df.head(args.limit)

    done_ids = load_done_ids(args.output)
    if done_ids:
        print(f"resume: {len(done_ids)} rows already processed, skipping them.")

    file_exists = os.path.exists(args.output)
    csv_file = open(args.output, "a", newline="", encoding="utf-8-sig")
    writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
    if not file_exists:
        writer.writeheader()
        csv_file.flush()

    total = len(df)
    processed_now = 0
    kept = 0
    corrected_count = 0
    invalid_count = 0

    for idx, row in df.iterrows():
        pair_id = row["pair_id"]
        if pair_id in done_ids:
            continue

        word1, word2 = row["word1"], row["word2"]
        pos_pattern = row.get("pos_pattern", "")
        examples_block = build_examples_block(row)

        print(f"[{processed_now+1}] (pair_id={pair_id}) {word1} + {word2} ...")

        try:
            result = call_llm(api_key, args.model, word1, word2, pos_pattern, examples_block)
        except RuntimeError as e:
            # Even if a row fails completely, the program doesn't stop; we simply
            # don't write this row to the CSV at all, so it will be retried on
            # the next pass (resume).
            print(f"    !! skipped, will be retried next run: {e}")
            time.sleep(args.sleep)
            continue

        status = result.get("status", "invalid")
        w1f = result.get("word1_final", word1)
        w2f = result.get("word2_final", word2)
        reason = result.get("reason", "")
        sentences_raw = result.get("sentences", []) or []
        # Normalize: support both the object form {"sentence":..,"target_span":..}
        # and a plain string
        norm_sentences = []
        for item in sentences_raw:
            if isinstance(item, dict):
                norm_sentences.append((item.get("sentence", "").strip(), item.get("target_span", "").strip()))
            else:
                norm_sentences.append((str(item).strip(), ""))
        norm_sentences = (norm_sentences + [("", "")] * 5)[:5]

        row_out = {
            "pair_id": pair_id,
            "word1_orig": word1,
            "word2_orig": word2,
            "pos_pattern": pos_pattern,
            "status": status,
            "word1_final": w1f,
            "word2_final": w2f,
            "reason": reason,
        }
        # Statistical metrics: copied directly from the original row, untouched by the model
        for col in STAT_COLUMNS:
            row_out[col] = row.get(col)

        n_sentences_ok = 0
        n_blank_ok = 0
        n_answer_ok = 0
        for i, (sent, span) in enumerate(norm_sentences, start=1):
            blank = make_blank_exercise(sent, span, w1f, w2f) if (status != "invalid" and sent) else None
            row_out[f"sentence_{i}"] = sent
            row_out[f"blank_{i}"] = blank

            answer_json = None
            if blank:
                # The correct answer is the exact span that was removed to create the blank
                correct_answer = span.strip() if (span and span.strip() in sent) else w2f
                options = build_answer_options(correct_answer, pos_pattern, distractor_pools, rng)
                ok, reason_v = verify_answer_options_full(options, correct_answer)
                if not ok:
                    print(f"    [answer-options verification warning, blank {i}]: {reason_v}")
                else:
                    n_answer_ok += 1
                answer_json = json.dumps(options, ensure_ascii=False)
            row_out[f"answer_blank_{i}"] = answer_json

            if sent:
                n_sentences_ok += 1
            if blank:
                n_blank_ok += 1

        writer.writerow(row_out)
        csv_file.flush()

        if status == "invalid":
            invalid_count += 1
            print(f"    -> invalid: {reason}")
        else:
            kept += 1
            if status == "corrected":
                corrected_count += 1
                print(f"    -> corrected to \u00ab{w1f} {w2f}\u00bb: {reason}")
            print(f"    -> {n_sentences_ok}/5 sentences, {n_blank_ok}/5 blanks, {n_answer_ok}/5 answer options built.")

        processed_now += 1
        time.sleep(args.sleep + random.uniform(0, 0.5))  # jitter to avoid a predictable request pattern

    csv_file.close()
    print("\n==================== Summary ====================")
    print(f"Processed in this run: {processed_now}")
    print(f"Total kept (valid+corrected): {kept}  | of which corrected: {corrected_count}")
    print(f"Detected as invalid: {invalid_count}")
    print(f"Output written to: {args.output}")
    print("If the script was interrupted, just re-run the same command; it will resume automatically.")


if __name__ == "__main__":
    main()
