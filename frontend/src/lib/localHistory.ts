import type { CollocationSummary } from "../types";

const RECENT_KEY = "hamvajeh:recentlyViewed";
const STATS_KEY = "hamvajeh:exerciseStats";
const MAX_RECENT = 10;

export interface RecentEntry extends CollocationSummary {
  viewedAt: number;
}

export interface ExerciseStats {
  correct: number;
  total: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// --- Recently viewed collocations ---

export function getRecentlyViewed(): RecentEntry[] {
  return safeParse<RecentEntry[]>(localStorage.getItem(RECENT_KEY), []);
}

export function recordCollocationView(collocation: CollocationSummary): void {
  try {
    const current = getRecentlyViewed().filter((c) => c.id !== collocation.id);
    const updated: RecentEntry[] = [{ ...collocation, viewedAt: Date.now() }, ...current].slice(
      0,
      MAX_RECENT
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable (private mode, quota, etc.) — fail silently,
    // this is a "nice to have" feature, not core functionality.
  }
}

// --- Exercise score tracking ---

export function getExerciseStats(): ExerciseStats {
  return safeParse<ExerciseStats>(localStorage.getItem(STATS_KEY), { correct: 0, total: 0 });
}

export function recordExerciseAttempt(isCorrect: boolean): void {
  try {
    const current = getExerciseStats();
    const updated: ExerciseStats = {
      correct: current.correct + (isCorrect ? 1 : 0),
      total: current.total + 1,
    };
    localStorage.setItem(STATS_KEY, JSON.stringify(updated));
  } catch {
    // same rationale as above
  }
}
