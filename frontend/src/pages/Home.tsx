import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchBox } from "../components/SearchBox";
import { CollocationCard } from "../components/CollocationCard";
import { SearchResultsSkeleton } from "../components/ui/Spinner";
import { getFeaturedCollocations } from "../api/collocations";
import type { CollocationSummary } from "../types";

const features = [
  { icon: "🔎", title: "جستجوی هوشمند", desc: "یک واژه را بنویسید تا باهم‌آیی‌های آن را ببینید." },
  { icon: "📖", title: "جمله‌های واقعی", desc: "برای هر باهم‌آیی، چند جمله‌ی نمونه‌ی طبیعی ببینید." },
  { icon: "✍️", title: "تمرین جای‌خالی", desc: "با تمرین‌های چهارگزینه‌ای، یادگیری‌تان را بسنجید." },
];

export function Home() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<CollocationSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");

  const loadFeatured = async () => {
    setStatus("loading");
    try {
      const res = await getFeaturedCollocations(6);
      setFeatured(res.results);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadFeatured();
  }, []);

  return (
    <div>
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-500 to-brand-700 px-6 py-16 text-center text-white sm:py-20">
        <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/10" />

        <h1 className="relative text-3xl font-extrabold sm:text-5xl">
          باهم‌آیی‌های فارسی را
          <br className="sm:hidden" /> اصولی یاد بگیرید
        </h1>
        <p className="relative mx-auto mt-4 max-w-xl text-brand-50 sm:text-lg">
          هم‌واژه به زبان‌آموزان غیرفارسی‌زبان کمک می‌کند ترکیب‌های طبیعی کلمات فارسی را
          پیدا کنند، در جمله ببینند، و با تمرین یاد بگیرند.
        </p>

        <div className="relative mx-auto mt-8 max-w-xl">
          <SearchBox
            onDebouncedChange={(value) => {
              if (value.trim()) navigate(`/search?q=${encodeURIComponent(value.trim())}`);
            }}
            placeholder="مثلاً «تصمیم» یا «سرمایه» را امتحان کنید…"
          />
        </div>
      </section>

      <section className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm"
          >
            <div className="text-2xl">{f.icon}</div>
            <div>
              <h3 className="text-sm font-bold text-ink-900">{f.title}</h3>
              <p className="text-xs text-ink-500">{f.desc}</p>
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

      <section className="mt-14 flex flex-col items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 px-6 py-10 text-center">
        <h2 className="text-xl font-bold text-brand-800">آماده‌اید مهارتتان را بسنجید؟</h2>
        <p className="max-w-md text-sm text-brand-700">
          یک تمرین تصادفی جای‌خالی را همین حالا امتحان کنید.
        </p>
        <button
          onClick={() => navigate("/exercise")}
          className="mt-2 rounded-full bg-brand-500 px-8 py-3 font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-md active:translate-y-0"
        >
          شروع تمرین
        </button>
      </section>
    </div>
  );
}
