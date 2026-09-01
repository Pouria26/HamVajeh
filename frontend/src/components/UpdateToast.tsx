import { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

export function UpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFn, setUpdateFn] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        // App shell is now cached and usable offline — no UI needed for this,
        // it's a nice-to-know, not an action the user must take.
      },
    });
    setUpdateFn(() => update);
  }, []);

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 top-16 z-30 mx-auto max-w-md px-3 sm:top-20">
      <div className="animate-fade-in-up flex items-center gap-3 rounded-2xl border border-brand-200 bg-white p-3 shadow-lg shadow-black/10">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500 text-base text-white">
          ✨
        </div>
        <p className="flex-1 text-sm font-medium text-ink-800">نسخه‌ی جدید هم‌واژه آماده است</p>
        <button
          onClick={() => updateFn?.(true)}
          className="shrink-0 rounded-full bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600"
        >
          به‌روزرسانی
        </button>
      </div>
    </div>
  );
}
