import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <div className="text-6xl">🧭</div>
      <h1 className="text-2xl font-bold text-ink-900">صفحه پیدا نشد</h1>
      <p className="text-ink-500">آدرسی که وارد کردید وجود ندارد.</p>
      <Link
        to="/"
        className="rounded-full bg-brand-500 px-6 py-2.5 font-medium text-white transition hover:bg-brand-600"
      >
        بازگشت به خانه
      </Link>
    </div>
  );
}
