import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCollocationDetail } from "../api/collocations";
import { ExampleCard } from "../components/ExampleCard";
import { ScoreBadge } from "../components/ScoreBadge";
import { ErrorState } from "../components/ui/States";
import { Spinner } from "../components/ui/Spinner";
import type { CollocationDetailResponse } from "../types";

export function CollocationDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CollocationDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "notfound" | "done">("loading");

  const load = async () => {
    if (!id) return;
    setStatus("loading");
    try {
      const res = await getCollocationDetail(id);
      setData(res);
      setStatus("done");
    } catch (err: unknown) {
      const isNotFound = (err as { status?: number })?.status === 404;
      setStatus(isNotFound ? "notfound" : "error");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (status === "notfound") {
    return (
      <ErrorState
        title="پیدا نشد"
        description="این باهم‌آیی در دیتابیس وجود ندارد."
      />
    );
  }

  if (status === "error" || !data) {
    return <ErrorState onRetry={load} />;
  }

  const { collocation, examples } = data;

  return (
    <div className="animate-fade-in-up">
      <Link to="/search" className="mb-6 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-brand-600">
        ← بازگشت به جستجو
      </Link>

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold text-ink-900 sm:text-4xl">
            {collocation.display_form}
          </h1>
          <ScoreBadge score={collocation.minmax_score} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {collocation.pos_pattern && (
            <span className="rounded-md bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600">
              الگوی نحوی: {collocation.pos_pattern}
            </span>
          )}
        </div>

        <Link
          to={`/exercise?collocationId=${collocation.id}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-2.5 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-md active:translate-y-0"
        >
          ✍️ تمرین همین باهم‌آیی
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-ink-900">جمله‌های نمونه</h2>
        {examples.length === 0 ? (
          <p className="text-sm text-ink-400">هنوز جمله‌ی نمونه‌ای برای این باهم‌آیی ثبت نشده است.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {examples.map((ex) => (
              <ExampleCard key={ex.id} index={ex.example_order} sentence={ex.sentence} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
