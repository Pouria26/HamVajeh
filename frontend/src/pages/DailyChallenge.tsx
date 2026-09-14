import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getDailyChallenge } from "../api/exercises";
import { ExerciseQuestion } from "../components/ExerciseQuestion";
import { ReportModal, ReportTrigger } from "../components/ReportModal";
import { Spinner } from "../components/ui/Spinner";
import { ErrorState } from "../components/ui/States";
import {
  getDailyChallengeResult,
  recordExerciseAttempt,
  saveDailyChallengeResult,
  todayUTC,
  tomorrowUTC,
  type DailyChallengeResult,
} from "../lib/localHistory";
import { shareOrCopy } from "../lib/share";
import type { DailyChallengeQuestion } from "../types";

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function verdictFor(percent: number): string {
  if (percent >= 80) return "عالی بود! 🎉";
  if (percent >= 50) return "خوب بود! 👏";
  return "ادامه بده! 💪";
}

export function DailyChallenge() {
  const date = todayUTC();
  const nextDate = tomorrowUTC();

  const [questions, setQuestions] = useState<DailyChallengeQuestion[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "playing" | "finished">("loading");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [shareLabel, setShareLabel] = useState("اشتراک‌گذاری نتیجه");
  const [reporting, setReporting] = useState(false);

  // Whether the score being shown/played counts as today's official record,
  // or is just a for-fun replay of the same 5 questions (doesn't overwrite it).
  const [isOfficialAttempt, setIsOfficialAttempt] = useState(true);
  const [savedResult, setSavedResult] = useState<DailyChallengeResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  const startTimer = () => {
    startedAtRef.current = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  };

  const loadChallenge = async () => {
    setStatus("loading");

    const existing = getDailyChallengeResult(date);
    setSavedResult(existing);

    try {
      const res = await getDailyChallenge();
      const randomized = res.exercises.map((ex) => ({
        ...ex,
        options: shuffleArray(ex.options),
      }));
      setQuestions(randomized);

      if (existing) {
        // Already completed today officially — show the saved result instead
        // of letting the score be overwritten by another playthrough.
        setScore(existing.score);
        setElapsed(existing.elapsedSeconds);
        setIsOfficialAttempt(false);
        setStatus("finished");
      } else {
        setIndex(0);
        setScore(0);
        setElapsed(0);
        setIsOfficialAttempt(true);
        setStatus("playing");
        startTimer();
      }
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadChallenge();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResult = (isCorrect: boolean) => {
    recordExerciseAttempt(isCorrect);
    if (isCorrect) setScore((s) => s + 1);
  };

  const handleNext = () => {
    setReporting(false);
    if (index + 1 >= questions.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      const finalElapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(finalElapsed);

      if (isOfficialAttempt) {
        const result: DailyChallengeResult = {
          score,
          total: questions.length,
          elapsedSeconds: finalElapsed,
          completedAt: Date.now(),
        };
        saveDailyChallengeResult(date, result);
        setSavedResult(result);
      }
      setStatus("finished");
    } else {
      setIndex((i) => i + 1);
    }
  };

  // "For fun" replay of the SAME 5 questions — does not touch today's saved record.
  const handlePracticeAgain = () => {
    setQuestions((prev) =>
      prev.map((ex) => ({
        ...ex,
        options: shuffleArray(ex.options),
      }))
    );
    setIndex(0);
    setScore(0);
    setElapsed(0);
    setIsOfficialAttempt(false);
    setStatus("playing");
    startTimer();
  };

  const handleShare = async () => {
    const text = `چالش روزانه‌ی هم‌واژه 🏆 (${date})\nدر ${formatTime(elapsed)} دقیقه، ${score} از ${questions.length} پاسخ درست دادم!\nتو چند تا درست جواب می‌دی؟`;
    const result = await shareOrCopy(text);
    if (result === "shared") setShareLabel("به اشتراک گذاشته شد ✓");
    else if (result === "copied") setShareLabel("در کلیپ‌بورد کپی شد ✓");
    else setShareLabel("اشتراک‌گذاری ممکن نشد");
    setTimeout(() => setShareLabel("اشتراک‌گذاری نتیجه"), 2500);
  };

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Spinner className="h-8 w-8 text-brand-500" />
        <p className="text-sm text-ink-400">در حال آماده‌سازی چالش امروز…</p>
      </div>
    );
  }

  if (status === "error") {
    return <ErrorState onRetry={loadChallenge} />;
  }

  if (status === "finished") {
    const total = questions.length;
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;

    return (
      <div className="animate-fade-in-up mx-auto flex max-w-md flex-col items-center gap-5 rounded-2xl border border-brand-100 bg-linear-to-br from-brand-50 to-white px-6 py-14 text-center shadow-sm">
        <div className="text-5xl">🏆</div>

        {!isOfficialAttempt && savedResult && (
          <span className="rounded-full bg-ink-100 px-3 py-1 text-xs font-medium text-ink-500">
            چالش امروز (<span dir="ltr" className="font-mono">{date}</span>) قبلاً انجام شده — این یک
            بازپخش تمرینی است
          </span>
        )}

        <h2 className="text-2xl font-bold text-ink-900">{verdictFor(percent)}</h2>
        <p className="text-ink-600">
          <span className="text-3xl font-extrabold text-brand-600">{score}</span> از {total} پاسخ
          درست
        </p>
        <p className="text-sm text-ink-400">زمان: {formatTime(elapsed)} دقیقه</p>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={handleShare}
            className="rounded-full bg-brand-500 px-6 py-2.5 font-medium text-white transition hover:bg-brand-600"
          >
            {shareLabel}
          </button>
          <button
            onClick={handlePracticeAgain}
            className="rounded-full border border-ink-200 bg-white px-6 py-2.5 font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-600"
          >
            تمرین آزاد همین ۵ سؤال
          </button>
        </div>
        <p className="mt-1 text-xs text-ink-400">
          چالش جدید فردا (<span dir="ltr" className="font-mono">{nextDate}</span>) در دسترس خواهد بود.
        </p>
        <Link to="/exercise" className="text-sm font-medium text-ink-500 underline underline-offset-2 hover:text-brand-600">
          یا تمرین کاملاً آزاد را امتحان کنید ←
        </Link>
      </div>
    );
  }

  const current = questions[index];
  const progress = ((index + 1) / questions.length) * 100;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-ink-500">
        <span className="flex items-center gap-2">
          سؤال {index + 1} از {questions.length}
          {!isOfficialAttempt && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs text-ink-400">تمرینی</span>
          )}
        </span>
        <span className="flex items-center gap-3">
          <span>{score} درست</span>
          <span className="rounded-full bg-ink-100 px-3 py-1 font-mono text-ink-700">
            ⏱ {formatTime(elapsed)}
          </span>
        </span>
      </div>
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ExerciseQuestion
        key={current.exampleId}
        exampleId={current.exampleId}
        blankSentence={current.blankSentence}
        options={current.options}
        onResult={handleResult}
        collocationDisplayForm={current.collocationDisplayForm}
      />

      <button
        onClick={handleNext}
        className="mt-5 w-full rounded-xl bg-ink-900 py-3 font-medium text-white transition hover:bg-ink-800 sm:w-auto sm:px-8"
      >
        {index + 1 === questions.length ? "پایان چالش 🏁" : "سؤال بعدی ←"}
      </button>

      <div className="mt-3">
        <ReportTrigger onClick={() => setReporting(true)} label="گزارش خطا در این سؤال" variant="outline" />
      </div>

      {reporting && current && (
        <ReportModal
          collocationId={current.collocationId ?? 0}
          exampleId={current.exampleId}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}
