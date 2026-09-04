import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCollocationExercises, getRandomExercise } from "../api/exercises";
import { recordExerciseAttempt } from "../lib/localHistory";
import { ExerciseQuestion } from "../components/ExerciseQuestion";
import { Spinner } from "../components/ui/Spinner";
import { EmptyState, ErrorState } from "../components/ui/States";
import { ReportModal, ReportTrigger } from "../components/ReportModal";
import type { CollocationExercise, RandomExerciseResponse } from "../types";

export function Exercise() {
  const [searchParams] = useSearchParams();
  const collocationId = searchParams.get("collocationId");

  if (collocationId) {
    return <CollocationExerciseSet collocationId={collocationId} />;
  }
  return <RandomExerciseMode />;
}

function RandomExerciseMode() {
  const [current, setCurrent] = useState<RandomExerciseResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [key, setKey] = useState(0); // forces ExerciseQuestion to remount for a fresh question
  const [reporting, setReporting] = useState(false);

  const load = async () => {
    setStatus("loading");
    try {
      const res = await getRandomExercise();
      setCurrent(res);
      setStatus("done");
      setKey((k) => k + 1);
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">تمرین آزاد</h1>
        {score.total > 0 && (
          <span className="rounded-full bg-ink-100 px-4 py-1.5 text-sm font-medium text-ink-600">
            {score.correct} از {score.total} درست
          </span>
        )}
      </div>

      {status === "loading" && (
        <div className="flex items-center justify-center py-24">
          <Spinner className="h-8 w-8 text-brand-500" />
        </div>
      )}

      {status === "error" && <ErrorState onRetry={load} />}

      {status === "done" && current && (
        <div className="animate-fade-in-up">
          <p className="mb-3 text-sm text-ink-400">
            باهم‌آیی هدف: <span className="font-semibold text-ink-600">{current.collocationDisplayForm}</span>
          </p>
          <ExerciseQuestion
            key={key}
            exampleId={current.exampleId}
            blankSentence={current.blankSentence}
            options={current.options}
            onResult={(isCorrect) => {
              recordExerciseAttempt(isCorrect);
              setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
            }}
          />
          <button
            onClick={load}
            className="mt-5 w-full rounded-xl bg-ink-900 py-3 font-medium text-white transition hover:bg-ink-800 sm:w-auto sm:px-8"
          >
            تمرین بعدی ←
          </button>
          <div className="mt-3">
            <ReportTrigger onClick={() => setReporting(true)} label="گزارش خطا در این سؤال" variant="outline" />
          </div>
        </div>
      )}

      {reporting && current && (
        <ReportModal
          collocationId={current.collocationId}
          exampleId={current.exampleId}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}

function CollocationExerciseSet({ collocationId }: { collocationId: string }) {
  const [exercises, setExercises] = useState<CollocationExercise[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    (async () => {
      setStatus("loading");
      try {
        const res = await getCollocationExercises(collocationId);
        setExercises(res.exercises);
        setStatus("done");
      } catch {
        setStatus("error");
      }
    })();
  }, [collocationId]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (status === "error") return <ErrorState />;

  if (exercises.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="تمرینی برای این باهم‌آیی موجود نیست"
        description="می‌توانید به‌جای آن تمرین آزاد را امتحان کنید."
      />
    );
  }

  const progress = ((index + 1) / exercises.length) * 100;
  const finished = index >= exercises.length;

  if (finished) {
    return (
      <div className="animate-fade-in-up flex flex-col items-center gap-4 rounded-2xl border border-success-500/30 bg-success-100/50 px-6 py-16 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-bold text-ink-900">تمرین تمام شد!</h2>
        <p className="text-ink-600">
          {score} از {exercises.length} پاسخ درست بود.
        </p>
        <Link
          to="/exercise"
          className="mt-2 rounded-full bg-brand-500 px-6 py-2.5 font-medium text-white transition hover:bg-brand-600"
        >
          تمرین آزاد دیگری امتحان کنید
        </Link>
      </div>
    );
  }

  const current = exercises[index];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-ink-500">
        <span>
          سؤال {index + 1} از {exercises.length}
        </span>
        <span>{score} درست</span>
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
        onResult={(isCorrect) => {
          recordExerciseAttempt(isCorrect);
          if (isCorrect) setScore((s) => s + 1);
        }}
      />

      <button
        onClick={() => setIndex((i) => i + 1)}
        className="mt-5 w-full rounded-xl bg-ink-900 py-3 font-medium text-white transition hover:bg-ink-800 sm:w-auto sm:px-8"
      >
        {index + 1 === exercises.length ? "پایان تمرین" : "سؤال بعدی ←"}
      </button>
      <div className="mt-3">
        <ReportTrigger onClick={() => setReporting(true)} label="گزارش خطا در این سؤال" variant="outline" />
      </div>

      {reporting && (
        <ReportModal
          collocationId={Number(collocationId)}
          exampleId={current.exampleId}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}
