import { useEffect, useState } from "react";
import { browseByPattern, getPatterns } from "../api/collocations";
import { CollocationCard } from "../components/CollocationCard";
import { SearchResultsSkeleton } from "../components/ui/Spinner";
import { EmptyState, ErrorState } from "../components/ui/States";
import { patternLabel } from "../lib/patternLabels";
import type { CollocationSummary, PatternCount } from "../types";

const PAGE_SIZE = 24;

export function Browse() {
  const [patterns, setPatterns] = useState<PatternCount[]>([]);
  const [patternsStatus, setPatternsStatus] = useState<"loading" | "error" | "done">("loading");
  const [selected, setSelected] = useState<string | null>(null);

  const [results, setResults] = useState<CollocationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [listStatus, setListStatus] = useState<"loading" | "error" | "done">("loading");

  useEffect(() => {
    (async () => {
      setPatternsStatus("loading");
      try {
        const res = await getPatterns();
        setPatterns(res.patterns);
        setPatternsStatus("done");
        if (res.patterns.length > 0) setSelected(res.patterns[0].pos_pattern);
      } catch {
        setPatternsStatus("error");
      }
    })();
  }, []);

  const loadPage = async (pattern: string, offset: number) => {
    setListStatus("loading");
    try {
      const res = await browseByPattern(pattern, PAGE_SIZE, offset);
      setResults((prev) => (offset === 0 ? res.results : [...prev, ...res.results]));
      setTotal(res.total);
      setListStatus("done");
    } catch {
      setListStatus("error");
    }
  };

  useEffect(() => {
    if (selected) loadPage(selected, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const selectedPattern = patterns.find((p) => p.pos_pattern === selected);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink-900">مرور بر اساس دسته</h1>
      <p className="mb-5 text-sm text-ink-500">
        اگر نمی‌دانید چه چیزی جستجو کنید، از میان الگوهای زیر یکی را انتخاب کنید.
      </p>

      {patternsStatus === "loading" && (
        <>
          {/* mobile skeleton: list rows */}
          <div className="mb-6 flex flex-col gap-2 sm:hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-ink-100" />
            ))}
          </div>
          {/* desktop skeleton: pills */}
          <div className="mb-6 hidden flex-wrap gap-2 sm:flex">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-ink-100" />
            ))}
          </div>
        </>
      )}

      {patternsStatus === "error" && <ErrorState />}

      {patternsStatus === "done" && (
        <>
          {/* Mobile: full-width tappable list, one row per category — avoids the
              ragged, hard-to-scan look of wrapped pills with uneven widths. */}
          <div className="mb-6 flex flex-col gap-1.5 rounded-2xl border border-ink-100 bg-white p-1.5 sm:hidden">
            {patterns.map((p) => {
              const isActive = selected === p.pos_pattern;
              return (
                <button
                  key={p.pos_pattern}
                  onClick={() => setSelected(p.pos_pattern)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-right text-sm font-medium transition ${
                    isActive ? "bg-brand-500 text-white shadow-sm" : "text-ink-700 active:bg-ink-50"
                  }`}
                >
                  <span>{patternLabel(p.pos_pattern)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                      isActive ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop: original wrapped pill grid, unchanged */}
          <div className="mb-8 hidden flex-wrap gap-2 sm:flex">
            {patterns.map((p) => (
              <button
                key={p.pos_pattern}
                onClick={() => setSelected(p.pos_pattern)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selected === p.pos_pattern
                    ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                    : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                {patternLabel(p.pos_pattern)}
                <span className="mr-1.5 opacity-70">({p.count})</span>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedPattern && (
        <p className="mb-4 text-sm font-medium text-ink-500 sm:hidden">
          دسته‌ی انتخاب‌شده: <span className="text-brand-600">{patternLabel(selectedPattern.pos_pattern)}</span>
        </p>
      )}

      {listStatus === "loading" && results.length === 0 && <SearchResultsSkeleton count={6} />}

      {listStatus === "error" && <ErrorState onRetry={() => selected && loadPage(selected, 0)} />}

      {listStatus === "done" && results.length === 0 && (
        <EmptyState icon="📂" title="در این دسته چیزی یافت نشد" />
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {results.map((c) => (
              <CollocationCard key={c.id} collocation={c} />
            ))}
          </div>

          {results.length < total && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => selected && loadPage(selected, results.length)}
                disabled={listStatus === "loading"}
                className="w-full rounded-full border border-ink-200 bg-white px-8 py-3 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 sm:w-auto sm:py-2.5"
              >
                {listStatus === "loading" ? "در حال بارگذاری…" : `نمایش بیشتر (${results.length} از ${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
