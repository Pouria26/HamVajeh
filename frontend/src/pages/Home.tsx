import { useNavigate } from "react-router-dom";
import { SearchBox } from "../components/SearchBox";

const features = [
  {
    icon: "🔎",
    title: "جستجوی هوشمند",
    desc: "یک واژه را بنویسید تا رایج‌ترین باهم‌آیی‌های آن را ببینید.",
  },
  {
    icon: "📖",
    title: "جمله‌های واقعی",
    desc: "برای هر باهم‌آیی، چند جمله‌ی نمونه‌ی طبیعی و کاربردی ببینید.",
  },
  {
    icon: "✍️",
    title: "تمرین جای‌خالی",
    desc: "با تمرین‌های چهارگزینه‌ای، یادگیری‌تان را بسنجید و تثبیت کنید.",
  },
];

export function Home() {
  const navigate = useNavigate();

  return (
    <div>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-16 text-center text-white sm:py-20">
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

      <section className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-ink-100 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >
            <div className="mb-3 text-4xl">{f.icon}</div>
            <h3 className="mb-1 font-bold text-ink-900">{f.title}</h3>
            <p className="text-sm text-ink-500">{f.desc}</p>
          </div>
        ))}
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
