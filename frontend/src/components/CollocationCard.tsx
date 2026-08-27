import { Link } from "react-router-dom";
import type { CollocationSummary } from "../types";
import { ScoreBadge } from "./ScoreBadge";

export function CollocationCard({ collocation }: { collocation: CollocationSummary }) {
  return (
    <Link
      to={`/collocation/${collocation.id}`}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md active:translate-y-0"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-lg font-bold text-ink-900 group-hover:text-brand-600">
          {collocation.display_form}
        </span>
        <div className="flex items-center gap-2">
          {collocation.pos_pattern && (
            <span className="rounded-md bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-500">
              {collocation.pos_pattern}
            </span>
          )}
          <ScoreBadge score={collocation.minmax_score} />
        </div>
      </div>
      <span
        aria-hidden
        className="shrink-0 text-ink-300 transition group-hover:-translate-x-1 group-hover:text-brand-500"
      >
        ←
      </span>
    </Link>
  );
}
