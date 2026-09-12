// The single "does this row exist for the public site at all" floor.
//
// Below this bar, a collocation must behave EVERYWHERE on the public
// (non-admin) side as if it had never been imported: /search won't find it,
// its detail page 404s, it's excluded from /browse and /patterns counts,
// exercises never draw from it (random, daily challenge, or the
// per-collocation list), other collocations' /related lists won't surface
// it, and answer-checking for one of its exercises 404s too.
//
// The admin panel is the one place this floor does NOT apply — curators
// need to see and fix/delete these rows, not have them invisible to
// everyone including themselves. None of backend/src/routes/admin.ts's
// queries reference this constant; that's intentional, not an oversight.
//
// Individual public routes may layer a STRICTER, feature-specific "quality"
// threshold on top of this (e.g. the homepage's featured picks use 0.4, well
// above this floor) — those are editorial choices about what looks good,
// separate from this existence floor. Routes should never go BELOW this
// value; see requireAtLeastFloor() below for a defensive helper.
export const PUBLIC_MIN_SCORE = 0.15;

// Clamps a route's own "quality" threshold so it can never accidentally end
// up more lenient than the public visibility floor (e.g. if someone tunes a
// local constant down later without realizing it would leak hidden rows).
// Usage: const FEATURED_QUALITY_THRESHOLD = requireAtLeastFloor(0.4);
export function requireAtLeastFloor(threshold: number): number {
    return Math.max(threshold, PUBLIC_MIN_SCORE);
}
