const PATTERN_LABELS: Record<string, string> = {
  "NOUN+VERB": "فعل مرکب",
  "VERB+NOUN": "فعل مرکب",
  "NOUN+NOUN": "اسم + اسم",
  "NOUN+ADJ": "اسم + صفت",
  "ADJ+NOUN": "صفت + اسم",
  "ADJ+VERB": "صفت + فعل",
  "ADJ+ADJ": "صفت + صفت",
  "NOUN+PROPN": "اسم + نام خاص",
  "PROPN+NOUN": "نام خاص + اسم",
  "ADJ+PROPN": "صفت + نام خاص",
  "PROPN+ADJ": "نام خاص + صفت",
  "PROPN+PROPN": "نام خاص + نام خاص",
  "NOUN+ADP": "اسم + حرف اضافه",
  "ADP+NOUN": "حرف اضافه + اسم",
  "ADP+VERB": "حرف اضافه + فعل",
  "PROPN+VERB": "نام خاص + فعل",
  "ADV+NOUN": "قید + اسم",
  "ADV+VERB": "قید + فعل",
};

export function patternLabel(pattern: string): string {
  return PATTERN_LABELS[pattern] ?? pattern;
}
