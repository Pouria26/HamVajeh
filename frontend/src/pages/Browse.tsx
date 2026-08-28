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

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-ink-900">مرور بر اساس دسته</h1>
      <p className="mb-6 text-sm text-ink-500">
        اگر نمی‌دانید چه چیزی جستجو کنید، از میان الگوهای زیر یکی را انتخاب کنید.
      </p>

      {patternsStatus === "loading" && (
        <div className="mb-6 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 w-28 animate-pulse rounded-full bg-ink-100" />
          ))}
        </div>
      )}

      {patternsStatus === "error" && <ErrorState />}

      {patternsStatus === "done" && (
        <div className="mb-8 flex flex-wrap gap-2">
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
                className="rounded-full border border-ink-200 bg-white px-8 py-2.5 text-sm font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50"
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
