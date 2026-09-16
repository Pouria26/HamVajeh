// Groups the dataset's raw pos_pattern values (e.g. "NOUN+NOUN", "ADJ+VERB")
// into a fixed set of 4 broad, learner-facing categories for the "Browse"
// page. The raw patterns are numerous (~24 distinct values) and many are
// near-duplicates or tiny long-tail buckets, so a flat list of them makes a
// poor navigation UI. These categories were chosen by looking at the actual
// distribution of pos_pattern across the dataset and grouping by linguistic
// role rather than raw POS-tag combination.
//
// A 5th category ("ترکیب با حرف اضافه" / preposition phrases) originally
// existed on its own, but with only a handful of matching rows it read as
// an oddly empty tab next to the big categories — so its patterns were
// folded into "سایر ترکیب‌ها" (OTHER), which already exists as the
// catch-all for every long-tail pattern. Net effect: 4 categories shown
// instead of 5, and OTHER absorbs the preposition patterns automatically
// (see categoryForPattern's fallback below) without needing to list them
// explicitly.
//
// IMPORTANT: keep this file and the frontend's copy
// (frontend/src/lib/patternCategories.ts) in sync — the category ids and
// the pattern lists must match exactly, since the browse UI's category
// picker relies on the frontend copy while all filtering happens here.

export interface PatternCategory {
    id: string;
    label: string;
    description: string;
    patterns: string[];
}

export const PATTERN_CATEGORIES: PatternCategory[] = [
    {
        id: "NOUN_NOUN",
        label: "ترکیب‌های اسمی",
        description: "دو اسم که در کنار هم یک مفهوم واحد می‌سازند (مثل «پدر و مادر»، «حقوق بشر»).",
        patterns: ["NOUN+NOUN", "NOUN+PROPN", "PROPN+NOUN", "NOUN"],
    },
    {
        id: "NOUN_ADJ",
        label: "ترکیب‌های وصفی",
        description: "اسم و صفتی که معمولاً با هم می‌آیند (مثل «نکته‌ی ایمنی»، «دختر نوجوان»).",
        patterns: ["NOUN+ADJ", "ADJ+NOUN", "ADJ+PROPN", "PROPN+ADJ", "ADJ+ADJ", "ADJ"],
    },
    {
        id: "VERB_PHRASE",
        label: "فعل‌های مرکب",
        description: "اسم یا صفتی که با یک فعل، فعل مرکب می‌سازد (مثل «قرار گرفتن»، «نشان دادن»).",
        patterns: ["NOUN+VERB", "VERB+NOUN", "PROPN+VERB", "VERB+PROPN", "ADJ+VERB", "ADV+VERB", "VERB"],
    },
    {
        id: "OTHER",
        label: "سایر ترکیب‌ها",
        description:
            "الگوهای کم‌تکرار دیگری که در دسته‌های بالا نمی‌گنجند؛ از جمله ترکیب‌های همراه با حرف اضافه (مثل «علی رغم اینکه»).",
        patterns: [], // catch-all — filled in dynamically below
    },
];

const CATEGORIZED_PATTERNS = new Set(
    PATTERN_CATEGORIES.flatMap((c) => c.patterns)
);

/** Returns the category id for a given raw pos_pattern (falls back to "OTHER"). */
export function categoryForPattern(pattern: string | null | undefined): string {
    if (!pattern) return "OTHER";
    for (const cat of PATTERN_CATEGORIES) {
        if (cat.patterns.includes(pattern)) return cat.id;
    }
    return "OTHER";
}

/** Returns the concrete pos_pattern list to filter by for a given category id.
 *  For "OTHER", returns null to signal "everything NOT in the other 4 categories"
 *  (handled specially in SQL via NOT IN, since that list is open-ended). */
export function patternsForCategory(categoryId: string): string[] | null {
    const cat = PATTERN_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat || cat.id === "OTHER") return null;
    return cat.patterns;
}

export function allCategorizedPatterns(): string[] {
    return Array.from(CATEGORIZED_PATTERNS);
}

export function categoryMeta(categoryId: string): PatternCategory | undefined {
    return PATTERN_CATEGORIES.find((c) => c.id === categoryId);
}

// Convenience for routes that return individual collocation rows to the
// public site and want a ready-to-display label (e.g. "ترکیب‌های اسمی")
// instead of the raw pos_pattern ("NOUN+NOUN") or having the frontend
// duplicate this same pattern→category mapping. This is the ONLY place that
// mapping lives — the frontend just displays whatever label this returns.
export function categoryLabelForPattern(pattern: string | null | undefined): string {
    const categoryId = categoryForPattern(pattern);
    return categoryMeta(categoryId)?.label ?? "سایر ترکیب‌ها";
}
