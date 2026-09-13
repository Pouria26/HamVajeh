import { useState } from "react";
import { checkAnswer } from "../api/exercises";
import { Spinner } from "./ui/Spinner";
import { ExerciseExplanationCard } from "./ExerciseExplanationCard";

interface Props {
  exampleId: number;
  blankSentence: string;
  options: { id: number; text: string }[];
  onResult?: (isCorrect: boolean) => void;
  collocationDisplayForm?: string;
}

export function ExerciseQuestion({ exampleId, blankSentence, options, onResult, collocationDisplayForm }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; correctAnswer: string } | null>(
    null
  );
  const [checking, setChecking] = useState(false);

  const handleSelect = async (optionId: number) => {
    if (checking || result) return;
    setSelectedId(optionId);
    setChecking(true);
    try {
      const res = await checkAnswer(exampleId, optionId);
      setResult(res);
      onResult?.(res.isCorrect);
    } catch {
      setResult(null);
      setSelectedId(null);
    } finally {
      setChecking(false);
    }
  };

  const parts = blankSentence.split("___________");
  const selectedOption = options.find((o) => o.id === selectedId);

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 pb-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
          <span>🎯</span>
          <span>جای خالی را با باهم‌آیی طبیعی تکمیل کنید:</span>
        </span>
        {result && collocationDisplayForm && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-bold text-brand-700 animate-fade-in">
            <span>✨ باهم‌آیی هدف:</span>
            <span>{collocationDisplayForm}</span>
          </span>
        )}
      </div>

      <p dir="rtl" className="mb-6 text-xl leading-10 text-ink-900">
        {parts[0]}
        <span
          className={`mx-1 inline-block min-w-24 rounded-lg border-b-2 px-2 py-0.5 text-center font-bold ${
            result
              ? result.isCorrect
                ? "border-success-500 bg-success-100 text-success-500"
                : "border-danger-500 bg-danger-100 text-danger-500"
              : "border-brand-400 bg-brand-50 text-brand-500"
          }`}
        >
          {result ? result.correctAnswer : "___________"}
        </span>
        {parts[1]}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = selectedId === option.id;
          const isCorrectOption = result && option.text === result.correctAnswer;
          const isWrongSelected = result && isSelected && !result.isCorrect;

          let stateClasses =
            "border-ink-200 bg-white hover:border-brand-300 hover:bg-brand-50";
          if (result) {
            if (isCorrectOption) {
              stateClasses = "border-success-500 bg-success-100 text-success-500";
            } else if (isWrongSelected) {
              stateClasses = "border-danger-500 bg-danger-100 text-danger-500 animate-shake";
            } else {
              stateClasses = "border-ink-100 bg-ink-50 text-ink-400";
            }
          }

          return (
            <button
              key={option.id}
              type="button"
              disabled={checking || !!result}
              onClick={() => handleSelect(option.id)}
              className={`flex items-center justify-between rounded-xl border-2 px-4 py-3 text-right text-base font-medium transition ${stateClasses} disabled:cursor-default`}
            >
              <span>{option.text}</span>
              {checking && isSelected && <Spinner className="h-4 w-4 text-brand-500" />}
              {isCorrectOption && <span>✓</span>}
              {isWrongSelected && <span>✕</span>}
            </button>
          );
        })}
      </div>

      {result && !result.isCorrect && selectedOption && (
        <ExerciseExplanationCard
          exampleId={exampleId}
          selectedOptionId={selectedOption.id}
          selectedOptionText={selectedOption.text}
          correctAnswerText={result.correctAnswer}
          blankSentence={blankSentence}
        />
      )}
    </div>
  );
}

