import { useEffect, useState } from "react";
import { usePwaInstall } from "../hooks/usePwaInstall";

const DISMISS_KEY = "hamvajeh:installPromptDismissedAt";
const DISMISS_DAYS = 14; // don't nag again for two weeks after a dismissal

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function wasRecentlyDismissed(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return daysSince < DISMISS_DAYS;
}

export function InstallPrompt() {
  const { canPromptInstall, isInstalled, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    setDismissed(wasRecentlyDismissed());
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // non-critical
    }
    setDismissed(true);
    setShowIOSInstructions(false);
  };

  if (isInstalled || dismissed) return null;

  const showIOSBanner = isIOS() && !canPromptInstall;
  if (!canPromptInstall && !showIOSBanner) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-30 mx-auto max-w-md px-3 sm:inset-x-auto sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0 sm:w-96 sm:max-w-none sm:px-0">
      <div className="animate-fade-in-up flex items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3 shadow-lg shadow-black/10">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-lg text-white">
          📲
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-900">نصب هم‌واژه روی دستگاه‌تان</p>
          <p className="text-xs text-ink-500">دسترسی سریع‌تر و استفاده حتی بدون اینترنت</p>
        </div>

        {canPromptInstall ? (
          <button
            onClick={async () => {
              const accepted = await promptInstall();
              if (accepted) handleDismiss();
            }}
            className="shrink-0 rounded-full bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600"
          >
            نصب
          </button>
        ) : (
          <button
            onClick={() => setShowIOSInstructions(true)}
            className="shrink-0 rounded-full bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600"
          >
            راهنما
          </button>
        )}

        <button
          onClick={handleDismiss}
          aria-label="بستن"
          className="shrink-0 text-ink-300 transition hover:text-ink-600"
        >
          ✕
        </button>
      </div>

      {showIOSInstructions && (
        <div className="animate-fade-in-up mt-2 rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-700 shadow-lg">
          <p className="mb-2 font-bold">نصب روی آیفون/آیپد:</p>
          <ol className="flex flex-col gap-1.5 text-ink-600">
            <li>۱. دکمه‌ی Share (□↑) پایین صفحه‌ی سافاری را بزنید</li>
            <li>۲. گزینه‌ی «Add to Home Screen» را انتخاب کنید</li>
            <li>۳. روی «Add» بزنید — آیکون هم‌واژه به صفحه‌ی اصلی اضافه می‌شود</li>
          </ol>
          <button
            onClick={handleDismiss}
            className="mt-3 w-full rounded-full bg-ink-100 py-2 text-xs font-medium text-ink-600"
          >
            متوجه شدم
          </button>
        </div>
      )}
    </div>
  );
}
