// A fixed-length placeholder, independent of the answer's word/character
// count — a blank whose length matches the answer would itself be a
// giveaway cue, so every blank uses exactly this marker.
export const BLANK_PLACEHOLDER = "___________";

export interface BuildBlankResult {
  blankSentence: string;
  matched: boolean;
}

/**
 * Replaces the first exact occurrence of `targetPhrase` inside `sentence`
 * with the fixed blank placeholder. If the phrase isn't found verbatim
 * (e.g. the admin typed the answer with different spacing/inflection than
 * what's actually in the sentence), returns the original sentence
 * unchanged with matched: false so the caller can warn instead of silently
 * producing a wrong blank.
 */
export function buildBlankSentence(sentence: string, targetPhrase: string): BuildBlankResult {
  const trimmedSentence = sentence.trim();
  const trimmedTarget = targetPhrase.trim();

  if (!trimmedSentence || !trimmedTarget) {
    return { blankSentence: trimmedSentence, matched: false };
  }

  const idx = trimmedSentence.indexOf(trimmedTarget);
  if (idx === -1) {
    return { blankSentence: trimmedSentence, matched: false };
  }

  const blankSentence =
    trimmedSentence.slice(0, idx) + BLANK_PLACEHOLDER + trimmedSentence.slice(idx + trimmedTarget.length);

  return { blankSentence, matched: true };
}
