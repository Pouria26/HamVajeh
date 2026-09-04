import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCollocationDetail, getRelatedCollocations } from "../api/collocations";
import { recordCollocationView } from "../lib/localHistory";
import { ExampleCard } from "../components/ExampleCard";
import { ScoreBadge } from "../components/ScoreBadge";
import { CollocationCard } from "../components/CollocationCard";
import { ErrorState } from "../components/ui/States";
import { Spinner } from "../components/ui/Spinner";
import { ReportModal, ReportTrigger } from "../components/ReportModal";
import { patternLabel } from "../lib/patternLabels";
import type { CollocationDetailResponse, CollocationSummary } from "../types";

export function CollocationDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CollocationDetailResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "notfound" | "done">("loading");

  const [related, setRelated] = useState<CollocationSummary[]>([]);
  const [relatedStatus, setRelatedStatus] = useState<"loading" | "error" | "done">("loading");

  // undefined: closed. { exampleId: undefined }: reporting the collocation
  // itself. { exampleId: N }: reporting one specific example sentence.
  const [reportTarget, setReportTarget] = useState<{ exampleId?: number } | null>(null);

  const load = async () => {
    if (!id) return;
    setStatus("loading");
    try {
      const res = await getCollocationDetail(id);
      setData(res);
      setStatus("done");
      recordCollocationView({
        id: res.collocation.id,
        pair_id: res.collocation.pair_id,
        display_form: res.collocation.display_form,
        pos_pattern: res.collocation.pos_pattern,
        minmax_score: res.collocation.minmax_score,
      });
    } catch (err: unknown) {
      const isNotFound = (err as { status?: number })?.status === 404;
      setStatus(isNotFound ? "notfound" : "error");
    }
  };

  const loadRelated = async () => {
    if (!id) return;
    setRelatedStatus("loading");
    try {
      const res = await getRelatedCollocations(id);
      setRelated(res.results);
      setRelatedStatus("done");
    } catch {
      setRelatedStatus("error");
    }
  };

  useEffect(() => {
    load();
    loadRelated();
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
              الگوی نحوی: {patternLabel(collocation.pos_pattern)}
            </span>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            to={`/exercise?collocationId=${collocation.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-2.5 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-md active:translate-y-0"
          >
            ✍️ تمرین همین باهم‌آیی
          </Link>
          <ReportTrigger onClick={() => setReportTarget({})} label="گزارش خطا در این باهم‌آیی" variant="outline" />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-ink-900">جمله‌های نمونه</h2>
        {examples.length === 0 ? (
          <p className="text-sm text-ink-400">هنوز جمله‌ی نمونه‌ای برای این باهم‌آیی ثبت نشده است.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {examples.map((ex) => (
              <ExampleCard
                key={ex.id}
                index={ex.example_order}
                sentence={ex.sentence}
                onReport={() => setReportTarget({ exampleId: ex.id })}
              />
            ))}
          </ul>
        )}
      </div>

      {relatedStatus !== "error" && (relatedStatus === "loading" || related.length > 0) && (
        <div className="mt-10">
          <h2 className="mb-4 text-lg font-bold text-ink-900">باهم‌آیی‌های مرتبط</h2>
          {relatedStatus === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-ink-400">
              <Spinner className="h-4 w-4" /> در حال بارگذاری…
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {related.map((c) => (
                <CollocationCard key={c.id} collocation={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {reportTarget && (
        <ReportModal
          collocationId={collocation.id}
          exampleId={reportTarget.exampleId}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
