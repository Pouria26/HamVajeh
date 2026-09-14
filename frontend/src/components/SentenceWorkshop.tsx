import { useState } from "react";
import { generateCollocationSentences } from "../api/agent";
import { Spinner } from "./ui/Spinner";
import { MarkdownContent } from "./MarkdownContent";
import type { GeneratedSentenceItem, SentenceContextType } from "../types";

interface SentenceWorkshopProps {
  collocationId: number;
  displayForm: string;
}

const CONTEXT_META: Record<
  SentenceContextType,
  {
    icon: string;
    badgeBg: string;
    badgeText: string;
    borderAccent: string;
    tagLabel: string;
    hint: string;
  }
> = {
  formal: {
    icon: "🏛️",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    badgeText: "text-blue-800",
    borderAccent: "border-r-4 border-r-blue-500",
    tagLabel: "رسمی و اداری",
    hint: "مناسب نامه‌نگاری‌ها، ابلاغیه‌ها و گزارش‌های سازمانی",
  },
  journalistic: {
    icon: "📰",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    badgeText: "text-purple-800",
    borderAccent: "border-r-4 border-r-purple-500",
    tagLabel: "مطبوعاتی و تحلیلی",
    hint: "مناسب مقالات رسانه‌ای، تحلیل‌های اقتصادی و متون علمی",
  },
  daily: {
    icon: "💬",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeText: "text-emerald-800",
    borderAccent: "border-r-4 border-r-emerald-500",
    tagLabel: "روزمره و داستانی",
    hint: "مناسب مکالمات صمیمانه، خاطره‌نویسی و کاربرد روزمره",
  },
};

export function SentenceWorkshop({ collocationId, displayForm }: SentenceWorkshopProps) {
  const [sentences, setSentences] = useState<GeneratedSentenceItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await generateCollocationSentences({
        collocation_id: collocationId,
        display_form: displayForm,
      });
      setSentences(res.sentences);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || "خطا در برقراری ارتباط با همیار هوشمند";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-b from-brand-50/40 via-white to-white p-6 shadow-sm transition-all sm:p-7">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-xl text-white shadow-sm shadow-brand-500/30">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-ink-900">
                کارگاه جمله‌ساز هوشمند همیار
              </h3>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                هوش مصنوعی
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-500">
              تولید ۳ جمله زنده و ملموس در بافت‌های رسمی، مطبوعاتی و روزمره با همیار زبان‌شناس
            </p>
          </div>
        </div>

        {/* Generate / Regenerate button */}
        {!sentences ? (
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-brand-600 hover:to-brand-700 hover:shadow-md active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Spinner className="h-4 w-4 text-white" />
                <span>همیار در حال نگارش...</span>
              </>
            ) : (
              <>
                <span>💡</span>
                <span>تولید ۳ جمله کاربردی جدید با همیار</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 active:translate-y-0.5 disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Spinner className="h-3.5 w-3.5 text-brand-600" />
                <span>در حال تولید مجدد...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>تولید مجدد جملات</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-xl border border-danger-100 bg-danger-100/50 p-4 text-sm text-danger-500">
          <p className="font-medium">{error}</p>
          <button
            onClick={handleGenerate}
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold underline hover:opacity-80"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !sentences && (
        <div className="mt-6 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-ink-100 bg-ink-50/70 p-4"
            >
              <div className="mb-2 h-4 w-28 rounded bg-ink-200" />
              <div className="h-5 w-3/4 rounded bg-ink-200" />
              <div className="mt-2 h-3 w-1/2 rounded bg-ink-100" />
            </div>
          ))}
        </div>
      )}

      {/* Generated Sentences Display */}
      {sentences && (
        <div className="mt-6 flex flex-col gap-4 animate-fade-in-up">
          {sentences.map((item, index) => {
            const meta = CONTEXT_META[item.context_type] || CONTEXT_META.formal;
            const isCopied = copiedIndex === index;

            return (
              <div
                key={index}
                className={`relative rounded-xl border border-ink-100 bg-white p-4 shadow-xs transition hover:border-ink-200 hover:shadow-sm sm:p-5 ${meta.borderAccent}`}
              >
                {/* Context badge & Copy button */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-xs font-bold ${meta.badgeBg}`}
                    >
                      <span>{meta.icon}</span>
                      <span>{item.context_title || meta.tagLabel}</span>
                    </span>
                    <span className="hidden text-xs text-ink-400 sm:inline">
                      {meta.hint}
                    </span>
                  </div>

                  <button
                    onClick={() => handleCopy(item.sentence, index)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 active:scale-95"
                    title="کپی کردن جمله"
                  >
                    {isCopied ? (
                      <>
                        <span className="text-success-500 font-bold">✓</span>
                        <span className="text-success-500">کپی شد!</span>
                      </>
                    ) : (
                      <>
                        <span>📋</span>
                        <span>کپی</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Sentence */}
                <p className="mt-3 text-base font-medium leading-8 text-ink-900 sm:text-lg">
                  {item.sentence}
                </p>

                {/* Explanation */}
                {item.explanation && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-ink-50 p-2.5 text-xs leading-6 text-ink-600">
                    <span className="shrink-0 text-sm">💡</span>
                    <MarkdownContent content={item.explanation} className="text-xs leading-6 text-ink-600 flex-1" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
