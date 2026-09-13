import { useState } from "react";
import { Link } from "react-router-dom";
import { explainExerciseError } from "../api/agent";
import { Spinner } from "./ui/Spinner";
import type { AgentExplainResponse } from "../types";

interface Props {
  exampleId: number;
  selectedOptionId: number;
  selectedOptionText: string;
  correctAnswerText: string;
  blankSentence: string;
}

export function ExerciseExplanationCard({
  exampleId,
  selectedOptionId,
  selectedOptionText,
  correctAnswerText,
  blankSentence,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AgentExplainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = async () => {
    if (loading || data) {
      setIsOpen((prev) => !prev);
      return;
    }

    setIsOpen(true);
    setLoading(true);
    setError(null);

    try {
      const res = await explainExerciseError({
        example_id: exampleId,
        selected_option_id: selectedOptionId,
      });
      setData(res);
    } catch (err: unknown) {
      const msg =
        (err as { message?: string })?.message ||
        "ارتباط با هم‌یار هوشمند برقرار نشد. لطفاً مجدداً تلاش فرمایید.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const tutorQuery = `در جمله «${blankSentence.replace(
    "___________",
    `[${correctAnswerText}]`
  )}»، چرا باهم‌آیی «${correctAnswerText}» صحیح است اما «${selectedOptionText}» توصیه نمی‌شود؟`;

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-brand-200/90 bg-gradient-to-br from-brand-50/80 via-white to-brand-50/40 p-4 shadow-sm transition sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500 text-base text-white shadow-xs">
            ✨
          </div>
          <div>
            <h4 className="text-sm font-bold text-ink-900">
              تحلیل هوشمند هم‌یار بر روی پاسخ شما
            </h4>
            <p className="text-xs text-ink-500">
              بررسی تفاوت زبان‌شناختی «{selectedOptionText}» و «{correctAnswerText}»
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchExplanation}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-600 active:scale-95 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Spinner className="h-3.5 w-3.5 text-white" />
              <span>در حال تحلیل پیکره…</span>
            </>
          ) : isOpen ? (
            <span>بستن تحلیل ▴</span>
          ) : (
            <span>چرا این گزینه اشتباه بود؟ ▾</span>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-brand-100 animate-fade-in-up">
          {loading && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="relative mb-3">
                <div className="h-10 w-10 rounded-full bg-brand-100 animate-ping opacity-75" />
                <div className="absolute inset-0 grid place-items-center text-xl">🤖</div>
              </div>
              <p className="text-sm font-medium text-brand-900">
                هم‌یار در حال کاوش در پیکره زبانی و تحلیل همنشینی واژگان است…
              </p>
              <p className="mt-1 text-xs text-ink-400">
                بررسی الگوهای نحوی، بسامد آماری و همنشینی طبیعی در زبان فارسی
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-danger-100 bg-danger-50/80 p-3.5 text-sm text-danger-700">
              <div className="flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={fetchExplanation}
                    className="mt-2 text-xs font-bold underline hover:no-underline"
                  >
                    تلاش مجدد
                  </button>
                </div>
              </div>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {data.agrees_with_database === "agree" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    تأیید برتری گزینه هدف در پیکره رسمی
                  </span>
                )}
                {data.agrees_with_database === "disagree" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                    انتخاب شما نیز کاربرد زبانی دارد (پاسخ دوگانه)
                  </span>
                )}
                {data.agrees_with_database === "uncertain" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-800">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-600" />
                    توضیح تکمیلی کاربرد باهم‌آیی
                  </span>
                )}

                <span className="rounded-full bg-white/80 border border-ink-100 px-2.5 py-1 text-ink-500">
                  اطمینان زبانی: {Math.round(data.confidence * 100)}٪
                </span>

                {data.flag_for_review && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-rose-700">
                    🚩 ثبت برای ممیزی دیتاست
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-white/90 p-4 border border-ink-100 text-sm leading-7 text-ink-800 shadow-2xs">
                <p className="whitespace-pre-line">{data.user_facing_answer}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <span className="text-ink-400">
                  💡 می‌خواهید درباره ساختار این جمله بیشتر تمرین کنید؟
                </span>
                <Link
                  to={`/tutor?q=${encodeURIComponent(tutorQuery)}`}
                  className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                >
                  ادامه گفتگو با هم‌یار در چت زنده ←
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
