import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SearchLauncher } from "../components/SearchLauncher";
import { CollocationCard } from "../components/CollocationCard";
import { SearchResultsSkeleton } from "../components/ui/Spinner";
import { getFeaturedCollocations } from "../api/collocations";
import { getExerciseStats, getRecentlyViewed } from "../lib/localHistory";
import type { CollocationSummary } from "../types";
import type { ExerciseStats, RecentEntry } from "../lib/localHistory";

const features = [
  { icon: "🔎", title: "جستجوی هوشمند", desc: "یک واژه بنویسید تا باهم‌آیی‌های آن را ببینید." },
  { icon: "📖", title: "جمله‌های واقعی", desc: "برای هر باهم‌آیی چند جمله‌ی نمونه ببینید." },
  { icon: "✍️", title: "تمرین جای‌خالی", desc: "با تمرین چهارگزینه‌ای یادگیری‌تان را بسنجید." },
  { icon: "🗂️", title: "مرور دسته‌ای", desc: "بدون دانستن کلمه‌ی خاص، بر اساس دسته کاوش کنید." },
];

export function Home() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<CollocationSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [recent] = useState<RecentEntry[]>(() => getRecentlyViewed());
  const [stats] = useState<ExerciseStats>(() => getExerciseStats());

  const loadFeatured = useCallback(async () => {
    setStatus("loading");
    try {
      const res = await getFeaturedCollocations(6);
      setFeatured(res.results);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    getFeaturedCollocations(6)
      .then((res) => {
        if (!ignore) {
          setFeatured(res.results);
          setStatus("done");
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatus("error");
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;

  return (
    <div>
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-500 via-brand-600 to-brand-700 px-6 py-16 text-center text-white sm:py-20">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute top-1/3 left-1/4 h-24 w-24 rounded-full bg-white/5" />

        <span className="relative inline-block rounded-full bg-white/15 px-4 py-1 text-xs font-medium tracking-wide backdrop-blur-sm">
          سامانه‌ی هوشمند آموزش باهم‌آیی‌های فارسی
        </span>

        <h1 className="relative mt-5 text-3xl font-extrabold sm:text-5xl">
          باهم‌آیی‌های فارسی را
          <br className="sm:hidden" /> اصولی یاد بگیرید
        </h1>
        <p className="relative mx-auto mt-4 max-w-xl text-brand-50 sm:text-lg">
          هم‌واژه به زبان‌آموزان غیرفارسی‌زبان کمک می‌کند ترکیب‌های طبیعی کلمات فارسی را
          پیدا کنند، در جمله ببینند، و با تمرین یاد بگیرند.
        </p>

        <div className="relative mx-auto mt-8 max-w-xl">
          <SearchLauncher />
        </div>

        <div className="relative mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-2 text-sm text-brand-50">
          <span className="opacity-80">پیشنهادها:</span>
          {["تصمیم", "قرار", "نشان"].map((w) => (
            <button
              key={w}
              onClick={() => navigate(`/search?q=${encodeURIComponent(w)}`)}
              className="rounded-full bg-white/15 px-3 py-1 font-medium backdrop-blur-sm transition hover:bg-white/25"
            >
              {w}
            </button>
          ))}
        </div>
      </section>

      {(recent.length > 0 || stats.total > 0) && (
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {stats.total > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:col-span-1">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-success-100 text-xl">
                🏆
              </div>
              <div>
                <p className="text-lg font-extrabold text-ink-900">
                  {stats.correct} از {stats.total}
                  <span className="mr-1 text-sm font-medium text-ink-400">({accuracy}٪)</span>
                </p>
                <p className="text-xs text-ink-500">پاسخ درست در تمرین‌ها</p>
              </div>
            </div>
          )}

          {recent.length > 0 && (
            <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:col-span-2">
              <p className="mb-2.5 text-sm font-bold text-ink-700">اخیراً دیده‌اید</p>
              <div className="flex flex-wrap gap-2">
                {recent.slice(0, 6).map((c) => (
                  <Link
                    key={c.id}
                    to={`/collocation/${c.id}`}
                    className="rounded-full bg-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 transition hover:bg-brand-100 hover:text-brand-700"
                  >
                    {c.display_form}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="flex flex-col items-center gap-2 rounded-2xl border border-ink-100 bg-white p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-2xl">{f.icon}</div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">{f.title}</h3>
              <p className="mt-0.5 text-xs text-ink-500">{f.desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-14">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink-900">باهم‌آیی‌های پرکاربرد</h2>
          {status === "done" && (
            <button
              onClick={loadFeatured}
              className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              نمونه‌های دیگر ↻
            </button>
          )}
        </div>

        {status === "loading" && <SearchResultsSkeleton count={6} />}

        {status === "error" && (
          <p className="text-sm text-ink-400">بارگذاری باهم‌آیی‌های پرکاربرد ممکن نشد.</p>
        )}

        {status === "done" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {featured.map((c) => (
              <CollocationCard key={c.id} collocation={c} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 px-6 py-10 text-center">
          <span className="absolute top-3 left-3 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-white">
            جدید
          </span>
          <div className="text-3xl">🏆</div>
          <h2 className="text-lg font-bold text-amber-900">چالش روزانه</h2>
          <p className="max-w-xs text-sm text-amber-700">۵ تمرین با تایمر، امتیازت را با دوستانت به اشتراک بگذار.</p>
          <button
            onClick={() => navigate("/challenge")}
            className="mt-2 rounded-full bg-amber-500 px-8 py-3 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-md active:translate-y-0"
          >
            شروع چالش
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-6 py-10 text-center">
          <div className="text-3xl">✍️</div>
          <h2 className="text-lg font-bold text-brand-800">تمرین آزاد</h2>
          <p className="max-w-xs text-sm text-brand-700">یک تمرین تصادفی جای‌خالی را بدون محدودیت زمانی امتحان کنید.</p>
          <button
            onClick={() => navigate("/exercise")}
            className="mt-2 rounded-full bg-brand-500 px-8 py-3 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-md active:translate-y-0"
          >
            شروع تمرین
          </button>
        </div>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-ink-100 bg-white px-6 py-10 text-center">
          <div className="text-3xl">🗂️</div>
          <h2 className="text-lg font-bold text-ink-900">نمی‌دانید چه جستجو کنید؟</h2>
          <p className="max-w-xs text-sm text-ink-500">بر اساس دسته‌بندی زبانی کاوش کنید.</p>
          <button
            onClick={() => navigate("/browse")}
            className="mt-2 rounded-full bg-ink-900 px-8 py-3 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-ink-800 hover:shadow-md active:translate-y-0"
          >
            مرور دسته‌ها
          </button>
        </div>
      </section>
    </div>
  );
}
