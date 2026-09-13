export interface CollocationSummary {
  id: number;
  pair_id: number;
  display_form: string;
  pos_pattern: string | null;
  // Ready-to-display label like "ترکیب‌های اسمی", computed server-side from
  // pos_pattern (see backend/src/lib/patternCategories.ts). The public UI
  // should always show this instead of the raw pos_pattern.
  pattern_category_label: string;
  minmax_score: number | null;
}

export interface PatternCount {
  category: string;
  label: string;
  description: string;
  count: number;
}

export interface PatternsResponse {
  patterns: PatternCount[];
}

export interface BrowseResponse {
  results: CollocationSummary[];
  total: number;
}

export interface CollocationDetail {
  id: number;
  pair_id: number;
  display_form: string;
  word1: string;
  word2: string | null;
  pos_pattern: string | null;
  pattern_category_label: string;
  pmi: number | null;
  t_score: number | null;
  llr: number | null;
  logdice: number | null;
  combined_score: number | null;
  minmax_score: number | null;
}

export interface ExampleSentence {
  id: number;
  sentence: string;
  example_order: number;
}

export interface CollocationDetailResponse {
  collocation: CollocationDetail;
  examples: ExampleSentence[];
}

export interface SearchResponse {
  results: CollocationSummary[];
}

export interface ExerciseOption {
  id: number;
  text: string;
}

export interface DailyChallengeQuestion {
  exampleId: number;
  collocationDisplayForm: string;
  blankSentence: string;
  options: ExerciseOption[];
}

export interface DailyChallengeResponse {
  date: string;
  exercises: DailyChallengeQuestion[];
}

export interface RandomExerciseResponse {
  exampleId: number;
  collocationId: number;
  collocationDisplayForm: string;
  blankSentence: string;
  options: ExerciseOption[];
}

export interface CollocationExercise {
  exampleId: number;
  exampleOrder: number;
  blankSentence: string;
  options: ExerciseOption[];
}

export interface CollocationExercisesResponse {
  exercises: CollocationExercise[];
}

export interface CheckAnswerResponse {
  isCorrect: boolean;
  correctAnswer: string;
}

// ---------------------------------------------------------------------------
// Admin / curation types
// ---------------------------------------------------------------------------

export interface AdminCollocationSummary {
  id: number;
  pair_id: number;
  word1: string;
  word2: string | null;
  display_form: string;
  pos_pattern: string | null;
  status: "valid" | "corrected";
  correction_note: string | null;
  minmax_score: number | null;
  needs_review: boolean;
  example_count: number;
}

export interface AdminCollocationListResponse {
  results: AdminCollocationSummary[];
  total: number;
  needsReviewTotal: number;
}

export interface AdminExerciseOption {
  id: number;
  example_id: number;
  option_text: string;
  option_order: number;
  is_correct: boolean;
}

export interface AdminExample {
  id: number;
  sentence: string;
  blank_sentence: string | null;
  target_phrase: string | null;
  example_order: number;
  options: AdminExerciseOption[];
}

export interface AdminCollocationFull {
  id: number;
  pair_id: number;
  word1: string;
  word2: string | null;
  display_form: string;
  pos_pattern: string | null;
  status: "valid" | "corrected";
  correction_note: string | null;
  pmi: number | null;
  t_score: number | null;
  llr: number | null;
  logdice: number | null;
  combined_score: number | null;
  minmax_score: number | null;
  needs_review: boolean;
}

export interface AdminCollocationDetailResponse {
  collocation: AdminCollocationFull;
  examples: AdminExample[];
}

export interface UpdateCollocationPayload {
  word1?: string;
  word2?: string | null;
  display_form?: string;
  pos_pattern?: string | null;
  status?: "valid" | "corrected";
  minmax_score?: number;
  needs_review?: boolean;
  correction_note?: string | null;
}

export interface UpdateExamplePayload {
  sentence?: string;
  blank_sentence?: string | null;
  target_phrase?: string | null;
  options?: { id: number; option_text?: string; is_correct?: boolean }[];
}

export interface NewExamplePayload {
  sentence: string;
  blank_sentence?: string | null;
  target_phrase?: string | null;
  options?: { option_text: string; is_correct: boolean }[];
}

// ---------------------------------------------------------------------------
// Reports ("این باهم‌آیی/جمله اشتباه است")
// ---------------------------------------------------------------------------

export type ReportReason = "wrong_collocation" | "wrong_sentence" | "wrong_answer" | "other";
export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface Report {
  id: number;
  collocation_id: number;
  example_id: number | null;
  reason: ReportReason;
  comment: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface AdminReport extends Report {
  collocation_display_form: string;
  collocation_pair_id: number;
  example_sentence: string | null;
}

export interface AdminReportListResponse {
  results: AdminReport[];
  total: number;
  pending: number;
}

export interface NewCollocationPayload {
  word1: string;
  word2?: string | null;
  display_form?: string;
  pos_pattern?: string | null;
  status?: "valid" | "corrected";
  correction_note?: string | null;
  // Single overall quality number (0–1); pmi/t_score/llr/logdice/combined_score
  // are derived from it server-side, so they're intentionally not here.
  minmax_score?: number;
  needs_review?: boolean;
  examples?: NewExamplePayload[];
}

// ---------------------------------------------------------------------------
// AI Tutor Agent types
// ---------------------------------------------------------------------------

export type AgentRole = "user" | "assistant" | "model";

export interface AgentChatMessage {
  id: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  suggestedFollowups?: string[];
  isError?: boolean;
}

export interface AgentChatPayload {
  message: string;
  history?: { role: AgentRole; content: string }[];
}

export interface AgentChatResponse {
  reply: string;
  suggested_followups: string[];
}

export interface AgentExplainPayload {
  example_id: number;
  selected_option_id: number;
}

export interface AgentExplainResponse {
  agrees_with_database: "agree" | "disagree" | "uncertain";
  confidence: number;
  linguistic_reasoning: string;
  user_facing_answer: string;
  flag_for_review: boolean;
}

export interface AgentHealthResponse {
  status: "ok" | "degraded" | "error";
  cached_explanations?: number;
  flagged_discrepancies?: number;
  error?: string;
  message?: string;
}

