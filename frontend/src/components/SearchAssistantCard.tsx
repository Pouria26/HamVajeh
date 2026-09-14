import { useState } from "react";
import { Link } from "react-router-dom";
import { getSearchAssistantAnalysis } from "../api/agent";
import { Spinner } from "./ui/Spinner";
import { MarkdownContent } from "./MarkdownContent";
import type { SearchAssistantResponse, SearchAssistantStatusType } from "../types";

interface SearchAssistantCardProps {
  query: string;
  onSelectCollocation: (collocation: string) => void;
}

const STATUS_THEME: Record<
  SearchAssistantStatusType,
  {
    badgeClass: string;
    icon: string;
  }
> = {
  unnatural_combination: {
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    icon: "⚠️",
  },
  compound_word: {
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
    icon: "🧩",
  },
  colloquial: {
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
    icon: "🗣️",
  },
  valid_not_in_db: {
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: "✨",
  },
  free_combination: {
    badgeClass: "bg-ink-100 text-ink-800 border-ink-200",
    icon: "📝",
  },
};

export function SearchAssistantCard({
  query,
  onSelectCollocation,
}: SearchAssistantCardProps) {
  const [analysis, setAnalysis] = useState<SearchAssistantResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getSearchAssistantAnalysis({ query });
      setAnalysis(res);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || "خطا در برقراری ارتباط با همیار هوشمند";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const theme = analysis
    ? STATUS_THEME[analysis.status_type] || STATUS_THEME.unnatural_combination
    : STATUS_THEME.unnatural_combination;

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-200/80 bg-gradient-to-b from-brand-50/50 via-white to-white p-6 shadow-sm transition-all sm:p-7">
      {!analysis && !isLoading && (
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-2xl text-white shadow-sm shadow-brand-500/30">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-ink-900 sm:text-lg">
                  همیار هوشمند هم‌واژه
                </h3>
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                  دستیار جستجو
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-600 leading-6">
                عبارت <strong className="text-ink-900 font-extrabold">«{query}»</strong> در پایگاه ثبتی یافت نشد. آیا مایلید تحلیل زبانی یا باهم‌آیی‌های معادل و اصیل آن را از همیار دریافت کنید؟
              </p>
            </div>
          </div>

          <button
            onClick={handleFetchAnalysis}
            className="inline-flex cursor-pointer shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 hover:shadow-md active:translate-y-0.5"
          >
            <span>✨</span>
            <span>دریافت تحلیل زبانی از همیار</span>
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Spinner className="h-8 w-8 text-brand-500" />
          <p className="mt-3 text-sm font-semibold text-ink-800">
            همیار در حال بررسی ساختار زبانی «{query}» و استخراج باهم‌آیی‌های اصیل است...
          </p>
          <p className="mt-1 text-xs text-ink-400">
            بررسی همنشینی واژگان، گونه‌های زبانی و ذائقه اهل زبان
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-xl border border-danger-100 bg-danger-100/40 p-4 text-sm text-danger-500">
          <p className="font-medium">{error}</p>
          <button
            onClick={handleFetchAnalysis}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold underline hover:opacity-80"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* Analysis Results Display */}
      {analysis && !isLoading && (
        <div className="animate-fade-in-up">
          {/* Header with status badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="text-base font-bold text-ink-900">
                  تحلیل زبانی همیار برای «{analysis.query}»
                </h3>
              </div>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${theme.badgeClass}`}
            >
              <span>{theme.icon}</span>
              <span>{analysis.badge_label}</span>
            </span>
          </div>

          {/* Summary Box */}
          <div className="mt-4 rounded-xl bg-brand-50/70 p-4 text-sm font-semibold leading-7 text-brand-900">
            <MarkdownContent content={analysis.summary} className="text-brand-900" />
          </div>

          {/* Detailed Linguistic Analysis */}
          <div className="mt-4 text-sm leading-7 text-ink-700">
            <MarkdownContent content={analysis.linguistic_analysis} />
          </div>

          {/* Suggested Authentic Collocations */}
          {analysis.suggested_collocations && analysis.suggested_collocations.length > 0 && (
            <div className="mt-5 rounded-xl border border-ink-100 bg-ink-50/60 p-4">
              <h4 className="text-xs font-bold text-ink-600">
                باهم‌آیی‌های اصیل و معادل‌های پیشنهادی در زبان فارسی:
              </h4>
              <p className="mt-0.5 text-xs text-ink-400">
                برای جستجو یا بررسی هر مورد، روی آن کلیک کنید:
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.suggested_collocations.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onSelectCollocation(item)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-2xs transition hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50 hover:shadow-xs active:translate-y-0"
                    title={`جستجوی باهم‌آیی «${item}»`}
                  >
                    <span>🔍</span>
                    <span>{item}</span>
                    <span className="text-ink-400 font-normal">←</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Example Sentence */}
          {analysis.example_sentence && (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 text-xs sm:text-sm text-emerald-900 leading-7">
              <span className="font-bold text-emerald-700 ml-1">📖 جمله نمونه کاربردی:</span>
              <span>«{analysis.example_sentence}»</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
            <Link
              to={`/tutor?q=${encodeURIComponent(
                `درباره عبارت «${analysis.query}» و تفاوت آن با باهم‌آیی‌های اصیل فارسی بیشتر برایم توضیح بده.`
              )}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              <span>💬</span>
              <span>ادامه گفتگو درباره این واژه در صفحه چت</span>
            </Link>

            <button
              onClick={handleFetchAnalysis}
              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-ink-500 hover:text-ink-800"
            >
              <span>🔄</span>
              <span>تحلیل مجدد</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
