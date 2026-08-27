import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-4xl">{icon}</div>}
      <p className="text-lg font-semibold text-ink-700">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-400">{description}</p>}
    </div>
  );
}

export function ErrorState({
  title = "مشکلی پیش آمد",
  description = "اتصال به سرور برقرار نشد. لطفاً دوباره تلاش کنید.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-danger-100 bg-danger-100/40 px-6 py-12 text-center">
      <div className="text-3xl">⚠️</div>
      <p className="text-lg font-semibold text-danger-500">{title}</p>
      <p className="max-w-sm text-sm text-ink-500">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-2 rounded-full bg-danger-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-red-700 active:scale-95"
        >
          تلاش دوباره
        </button>
      )}
    </div>
  );
}
