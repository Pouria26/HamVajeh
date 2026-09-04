import { useEffect, useRef, useState, type ReactElement } from "react";
import { submitReport } from "../api/reports";
import type { ReportReason } from "../types";

// ---------------------------------------------------------------------------
// Small inline icon set (no icon library is installed in this project, and
// pulling one in just for ~6 icons isn't worth the bundle weight — these are
// hand-picked outline icons in the app's brand style, stroke-based so they
// inherit currentColor and stay crisp at any size).
// ---------------------------------------------------------------------------

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 3v18M5 4.5c1.4-1 3-1.5 4.5-1.5 2 0 3.5 1.2 5.5 1.2 1.5 0 3.1-.5 4.5-1.5v10c-1.4 1-3 1.5-4.5 1.5-2 0-3.5-1.2-5.5-1.2-1.5 0-3.1.5-4.5 1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="m3 11 17-8-8 17-2.5-7.5L3 11Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`animate-spin ${className ?? ""}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m7.5 12.5 3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 3.5 22 20.5H2L12 3.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 9.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Per-reason icons, drawn simply so they read well at ~18px.
function LinkOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9.5 14.5 14.5 9.5M9 7h-.5A4.5 4.5 0 0 0 4 11.5v0A4.5 4.5 0 0 0 8.5 16H9m6-9h.5A4.5 4.5 0 0 1 20 11.5v0a4.5 4.5 0 0 1-4.5 4.5H15"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TextEditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 6.5h13M4 12h9M4 17.5h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="m17.5 14.5 3 3L15 23l-3.3.5.5-3.3 5.3-5.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M9 6.5h11M9 12h11M9 17.5h11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="m3.2 6.5 1 1L6.5 5.3M3.2 17.5l1 1 2.3-2.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

const REASON_OPTIONS: {
  value: ReportReason;
  label: string;
  icon: (p: { className?: string }) => ReactElement;
}[] = [
  { value: "wrong_collocation", label: "این باهم‌آیی طبیعی/درست نیست", icon: LinkOffIcon },
  { value: "wrong_sentence", label: "جمله‌ی نمونه غلط یا نامربوط است", icon: TextEditIcon },
  { value: "wrong_answer", label: "گزینه‌های تمرین اشتباه است", icon: ListCheckIcon },
  { value: "other", label: "چیز دیگری", icon: DotsIcon },
];

const COMMENT_LIMIT = 1000;

interface ReportModalProps {
  collocationId: number;
  exampleId?: number;
  onClose: () => void;
}

export function ReportModal({ collocationId, exampleId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>(exampleId ? "wrong_sentence" : "wrong_collocation");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/10 p-4 backdrop-blur-[3px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
        className="animate-scale-in relative w-full max-w-md overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-2xl shadow-ink-900/10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="بستن"
          className="absolute left-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
        >
          <CloseIcon className="h-4 w-4" />
        </button>

        {status === "sent" ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-100 text-success-500">
              <CheckCircleIcon className="h-8 w-8" />
            </div>
            <h2 className="mb-1.5 text-lg font-bold text-ink-900">گزارش شما ثبت شد</h2>
            <p className="mb-6 text-sm leading-6 text-ink-500">
              ممنون! این مورد برای بررسی به تیم دیتاست ارسال شد و به‌زودی بازبینی می‌شود.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-full bg-brand-500 px-6 py-2.5 font-medium text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-600 active:scale-[0.98]"
            >
              بستن
            </button>
          </div>
        ) : (
          <div className="p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-100 text-danger-500">
                <FlagIcon className="h-5 w-5" />
              </div>
              <div className="pt-1">
                <h2 id="report-modal-title" className="text-lg font-bold text-ink-900">
                  گزارش خطا
                </h2>
                <p className="mt-0.5 text-sm text-ink-500">
                  {exampleId
                    ? "چه مشکلی در این جمله‌ی نمونه دیده‌اید؟"
                    : "چه مشکلی در این باهم‌آیی دیده‌اید؟"}
                </p>
              </div>
            </div>

            <div role="radiogroup" aria-label="دلیل گزارش" className="mb-4 flex flex-col gap-2">
              {REASON_OPTIONS.map((opt) => {
                const isActive = reason === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setReason(opt.value)}
                    className={`group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-right text-sm font-medium transition-all ${
                      isActive
                        ? "border-brand-500 bg-brand-50 text-brand-700 shadow-sm"
                        : "border-ink-200 bg-white text-ink-700 hover:border-brand-200 hover:bg-brand-50/40"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${
                        isActive
                          ? "bg-brand-500 text-white"
                          : "bg-ink-100 text-ink-500 group-hover:bg-brand-100 group-hover:text-brand-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1">{opt.label}</span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        isActive ? "border-brand-500" : "border-ink-300"
                      }`}
                    >
                      {isActive && <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mb-1">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, COMMENT_LIMIT))}
                placeholder="توضیح بیشتر (اختیاری)…"
                rows={3}
                maxLength={COMMENT_LIMIT}
                className="w-full resize-none rounded-2xl border border-ink-200 p-3.5 text-sm leading-6 text-ink-800 outline-none transition focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
              />
              <div className="mt-1 text-left text-xs text-ink-300">
                {comment.length}/{COMMENT_LIMIT}
              </div>
            </div>

            {status === "error" && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-danger-100 px-3.5 py-2.5 text-sm text-danger-700">
                <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                ارسال گزارش ممکن نشد. دوباره تلاش کنید.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-full border border-ink-200 px-4 py-2.5 text-sm font-medium text-ink-600 transition hover:border-ink-300 hover:bg-ink-50 active:scale-[0.98]"
              >
                انصراف
              </button>
              <button
                onClick={submit}
                disabled={status === "sending"}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-500/30 transition hover:bg-brand-600 active:scale-[0.98] disabled:opacity-60"
              >
                {status === "sending" ? (
                  <>
                    <SpinnerIcon className="h-4 w-4" />
                    در حال ارسال…
                  </>
                ) : (
                  <>
                    <SendIcon className="h-4 w-4 -scale-x-100" />
                    ارسال گزارش
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Trigger button meant to sit next to content that can be reported. Comes in
// two visual flavors: "inline" (a quiet text link, for tight spots like
// under an example sentence) and "outline" (a small pill button with a
// visible border, for standalone spots like a page header/footer action).
export function ReportTrigger({
  onClick,
  label,
  variant = "inline",
}: {
  onClick: () => void;
  label?: string;
  variant?: "inline" | "outline";
}) {
  if (variant === "outline") {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-medium text-ink-500 transition hover:border-danger-200 hover:bg-danger-50 hover:text-danger-600 active:scale-[0.97]"
      >
        <FlagIcon className="h-3.5 w-3.5" />
        {label ?? "گزارش خطا"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-ink-400 transition hover:bg-danger-50 hover:text-danger-600 active:scale-[0.97]"
    >
      <FlagIcon className="h-3.5 w-3.5 transition-transform group-hover:-rotate-6" />
      {label ?? "گزارش خطا"}
    </button>
  );
}
