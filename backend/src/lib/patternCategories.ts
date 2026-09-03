// Groups the dataset's raw pos_pattern values (e.g. "NOUN+NOUN", "ADJ+VERB")
// into a fixed set of 5 broad, learner-facing categories for the "Browse"
// page. The raw patterns are numerous (~24 distinct values) and many are
// near-duplicates or tiny long-tail buckets, so a flat list of them makes a
// poor navigation UI. These 5 categories were chosen by looking at the
// actual distribution of pos_pattern across the dataset and grouping by
// linguistic role rather than raw POS-tag combination.
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
        description: "دو اسم که در کنار هم یک مفهوم واحد می‌سازند (مثل «سرمایه‌گذاری»، «حقوق بشر»).",
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
        id: "PREP_PHRASE",
        label: "ترکیب با حرف اضافه",
        description: "باهم‌آیی‌هایی که با یک حرف اضافه همراه می‌شوند (مثل «وارد گفتگو»).",
        patterns: ["NOUN+ADP", "ADP+NOUN", "ADJ+ADP", "ADP+ADJ", "ADP+VERB", "VERB+ADP"],
    },
    {
        id: "OTHER",
        label: "سایر ترکیب‌ها",
        description: "الگوهای کم‌تکرار دیگری که در دسته‌های بالا نمی‌گنجند.",
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
