import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { searchCollocations } from "../api/collocations";
import { SearchBox } from "../components/SearchBox";
import { CollocationCard } from "../components/CollocationCard";
import { SearchResultsSkeleton } from "../components/ui/Spinner";
import { EmptyState, ErrorState } from "../components/ui/States";
import { SearchAssistantCard } from "../components/SearchAssistantCard";
import type { CollocationSummary } from "../types";

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CollocationSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");

  const runSearch = async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    try {
      const res = await searchCollocations(q.trim());
      setResults(res.results);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (initialQuery) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDebouncedChange = (value: string) => {
    setSearchParams(value ? { q: value } : {}, { replace: true });
    runSearch(value);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink-900">جستجوی باهم‌آیی</h1>

      <SearchBox initialValue={query} onDebouncedChange={(v) => { setQuery(v); handleDebouncedChange(v); }} autoFocus />

      <div className="mt-6">
        {status === "idle" && (
          <EmptyState
            icon="✨"
            title="یک واژه را جستجو کنید"
            description="مثلاً «قرار»، «سرمایه»، یا «نشان» را بنویسید تا باهم‌آیی‌های رایج آن را ببینید."
          />
        )}

        {status === "loading" && <SearchResultsSkeleton />}

        {status === "error" && <ErrorState onRetry={() => runSearch(query)} />}

        {status === "done" && results.length === 0 && (
          <div className="flex flex-col gap-4">
            <SearchAssistantCard
              query={query}
              onSelectCollocation={(suggested) => {
                setQuery(suggested);
                setSearchParams({ q: suggested }, { replace: true });
                runSearch(suggested);
              }}
            />
          </div>
        )}

        {status === "done" && results.length > 0 && (
          <div className="flex flex-col gap-3">
            {results.map((c) => (
              <CollocationCard key={c.id} collocation={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
