import { useState } from "react";
import { submitReport } from "../api/reports";
import type { ReportReason } from "../types";

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: "wrong_collocation", label: "این باهم‌آیی طبیعی/درست نیست" },
  { value: "wrong_sentence", label: "جمله‌ی نمونه غلط یا نامربوط است" },
  { value: "wrong_answer", label: "گزینه‌های تمرین اشتباه است" },
  { value: "other", label: "چیز دیگری" },
];

interface ReportModalProps {
  collocationId: number;
  exampleId?: number;
  onClose: () => void;
}

export function ReportModal({ collocationId, exampleId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>(exampleId ? "wrong_sentence" : "wrong_collocation");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = async () => {
    setStatus("sending");
    try {
      await submitReport(collocationId, {
        reason,
        comment: comment.trim() || undefined,
        example_id: exampleId,
      });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/10 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "sent" ? (
          <div className="text-center">
            <div className="mb-2 text-3xl">✅</div>
            <h2 className="mb-1 text-lg font-bold text-ink-900">گزارش شما ثبت شد</h2>
            <p className="mb-5 text-sm text-ink-500">
              ممنون! این مورد برای بررسی به تیم دیتاست ارسال شد.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-full bg-brand-500 px-6 py-2.5 font-medium text-white transition hover:bg-brand-600"
            >
              بستن
            </button>
          </div>
        ) : (
          <>
            <h2 className="mb-1 text-lg font-bold text-ink-900">گزارش خطا</h2>
            <p className="mb-4 text-sm text-ink-500">
              {exampleId
                ? "چه مشکلی در این جمله‌ی نمونه دیده‌اید؟"
                : "چه مشکلی در این باهم‌آیی دیده‌اید؟"}
            </p>

            <div className="mb-4 flex flex-col gap-2">
              {REASON_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition ${
                    reason === opt.value
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-ink-200 text-ink-700 hover:border-brand-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    className="accent-brand-500"
                    checked={reason === opt.value}
                    onChange={() => setReason(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="توضیح بیشتر (اختیاری)…"
              rows={3}
              maxLength={1000}
              className="mb-4 w-full resize-none rounded-xl border border-ink-200 p-3 text-sm text-ink-800 outline-none focus:border-brand-400"
            />

            {status === "error" && (
              <p className="mb-3 text-sm text-danger-500">ارسال گزارش ممکن نشد. دوباره تلاش کنید.</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-full border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 transition hover:border-ink-300"
              >
                انصراف
              </button>
              <button
                onClick={submit}
                disabled={status === "sending"}
                className="flex-1 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
              >
                {status === "sending" ? "در حال ارسال…" : "ارسال گزارش"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Small trigger button meant to sit next to content that can be reported.
export function ReportTrigger({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-ink-400 transition hover:text-danger-500"
    >
      🚩 {label ?? "گزارش خطا"}
    </button>
  );
}
