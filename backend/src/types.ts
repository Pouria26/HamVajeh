export interface CsvRow {
    pair_id: string;
    word1_orig: string;
    word2_orig: string;
    pos_pattern: string;
    status: string;
    word1_final: string;
    word2_final: string;
    reason: string;
    pmi: string;
    t_score: string;
    llr: string;
    logdice: string;
    combined_score: string;
    minmax_score: string;
    [key: string]: string; // sentence_1..5, blank_1..5, answer_blank_1..5
}

export interface Collocation {
    id: number;
    pair_id: number;
    word1: string;
    word2: string | null;
    display_form: string;
    pos_pattern: string | null;
    status: "valid" | "corrected";
    pmi: number | null;
    t_score: number | null;
    llr: number | null;
    logdice: number | null;
    combined_score: number | null;
    minmax_score: number | null;
}

export interface Example {
    id: number;
    collocation_id: number;
    sentence: string;
    blank_sentence: string | null;
    target_phrase: string | null;
    example_order: number;
}

export interface ExerciseOption {
    id: number;
    example_id: number;
    option_text: string;
    option_order: number;
    is_correct: boolean;
}
