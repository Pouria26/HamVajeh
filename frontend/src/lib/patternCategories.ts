// Mirrors backend/src/lib/patternCategories.ts — the 4 broad categories used
// on the "Browse" page. The frontend only needs the id → label/description
// mapping (the actual raw pos_pattern lists and filtering live server-side).

export const CATEGORY_META: Record<string, { label: string; description: string }> = {
  NOUN_NOUN: {
    label: "ترکیب‌های اسمی",
    description: "دو اسم که در کنار هم یک مفهوم واحد می‌سازند.",
  },
  NOUN_ADJ: {
    label: "ترکیب‌های وصفی",
    description: "اسم و صفتی که معمولاً با هم می‌آیند.",
  },
  VERB_PHRASE: {
    label: "فعل‌های مرکب",
    description: "اسم یا صفتی که با یک فعل، فعل مرکب می‌سازد.",
  },
  OTHER: {
    label: "سایر ترکیب‌ها",
    description: "الگوهای کم‌تکرار دیگری که در دسته‌های بالا نمی‌گنجند؛ از جمله ترکیب‌های همراه با حرف اضافه.",
  },
};

export function categoryLabel(categoryId: string): string {
  return CATEGORY_META[categoryId]?.label ?? categoryId;
}
