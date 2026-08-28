import { useNavigate } from "react-router-dom";

export function SearchLauncher({
  placeholder = "یک واژه‌ی فارسی بنویسید، مثلاً «تصمیم»…",
}: {
  placeholder?: string;
}) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/search")}
      className="group flex w-full items-center gap-3 rounded-2xl border border-white/40 bg-white py-4 pr-4 pl-5 text-right text-lg text-ink-400 shadow-lg shadow-black/10 outline-none transition hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
    >
      <span aria-hidden className="text-brand-500">
        🔍
      </span>
      <span className="flex-1">{placeholder}</span>
      <span
        aria-hidden
        className="hidden shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 transition group-hover:bg-brand-100 sm:inline-block"
      >
        جستجو ←
      </span>
    </button>
  );
}
