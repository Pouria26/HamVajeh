export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;

  const percent = Math.round(score * 100);
  const level = percent >= 60 ? "strong" : percent >= 35 ? "medium" : "light";

  const styles = {
    strong: "bg-success-100 text-success-500",
    medium: "bg-brand-100 text-brand-600",
    light: "bg-ink-100 text-ink-500",
  } as const;

  const labels = {
    strong: "پرکاربرد",
    medium: "متداول",
    light: "کم‌کاربرد",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[level]}`}
      title={`امتیاز کیفیت: ${percent}٪`}
    >
      {labels[level]}
    </span>
  );
}
