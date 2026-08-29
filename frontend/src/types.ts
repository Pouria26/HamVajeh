export interface CollocationSummary {
  id: number;
  pair_id: number;
  display_form: string;
  pos_pattern: string | null;
  minmax_score: number | null;
}

export interface PatternCount {
  pos_pattern: string;
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
