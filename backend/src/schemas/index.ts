import { z } from "zod";

// Helper for parsing integer strings or numbers into positive integers
export const positiveIntParam = (fieldName = "id") =>
    z.coerce
        .number({ message: `invalid_${fieldName}` })
        .int({ message: `invalid_${fieldName}` })
        .positive({ message: `invalid_${fieldName}` });

// ---------------------------------------------------------------------------
// Collocations Schemas
// ---------------------------------------------------------------------------

export const searchQuerySchema = z.object({
    q: z.string().optional().default(""),
    limit: z.coerce.number({ message: "invalid_limit" }).int().min(1).max(50).optional().default(20),
});

export const featuredQuerySchema = z.object({
    limit: z.coerce.number({ message: "invalid_limit" }).int().min(1).max(20).optional().default(6),
});

export const browseQuerySchema = z.object({
    category: z.string().min(1, { message: "missing_category" }),
    limit: z.coerce.number({ message: "invalid_limit" }).int().min(1).max(60).optional().default(24),
    offset: z.coerce.number({ message: "invalid_offset" }).int().min(0).optional().default(0),
});

export const collocationIdParamSchema = z.object({
    id: positiveIntParam("id"),
});

export const relatedQuerySchema = z.object({
    limit: z.coerce.number({ message: "invalid_limit" }).int().min(1).max(20).optional().default(6),
});

export const createReportSchema = z.object({
    reason: z.enum(["wrong_collocation", "wrong_sentence", "wrong_answer", "other"], {
        message: "invalid_reason",
    }),
    comment: z
        .string()
        .max(1000)
        .optional()
        .nullable()
        .transform((val) => (val && val.trim() ? val.trim() : null)),
    example_id: z.coerce.number().int().positive().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Exercises Schemas
// ---------------------------------------------------------------------------

export const collocationExercisesParamSchema = z.object({
    collocationId: positiveIntParam("id"),
});

export const checkAnswerParamSchema = z.object({
    exampleId: positiveIntParam("id"),
});

export const checkAnswerBodySchema = z.object({
    optionId: z.coerce
        .number({ message: "invalid_input" })
        .int({ message: "invalid_input" })
        .positive({ message: "invalid_input" }),
});

// ---------------------------------------------------------------------------
// Admin Schemas
// ---------------------------------------------------------------------------

export const adminListQuerySchema = z.object({
    search: z.string().optional().default(""),
    status: z.enum(["valid", "corrected", ""]).optional().default(""),
    needs_review: z.string().optional().default(""),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const adminCreateCollocationSchema = z.object({
    word1: z.string({ message: "word1_required" }).min(1, { message: "word1_required" }),
    word2: z.string().optional().nullable(),
    display_form: z.string().optional().nullable(),
    pos_pattern: z.string().optional().nullable(),
    status: z.enum(["valid", "corrected"]).optional().default("valid"),
    reason: z.string().optional().nullable(),
    correction_note: z.string().optional().nullable(),
    minmax_score: z.coerce.number().min(0).max(1).optional().default(0.5),
    needs_review: z.boolean().optional().default(false),
    examples: z
        .array(
            z.object({
                sentence: z.string().min(1, { message: "example_sentence_required" }),
                blank_sentence: z.string().optional().nullable(),
                target_phrase: z.string().optional().nullable(),
                options: z
                    .array(
                        z.object({
                            option_text: z.string().min(1),
                            is_correct: z.boolean(),
                        })
                    )
                    .optional(),
            })
        )
        .max(5, { message: "too_many_examples" })
        .optional()
        .default([]),
});

export const adminPatchCollocationSchema = z.object({
    word1: z.string().optional(),
    word2: z.string().optional().nullable(),
    display_form: z.string().optional(),
    pos_pattern: z.string().optional().nullable(),
    status: z.enum(["valid", "corrected"]).optional(),
    correction_note: z.string().optional().nullable(),
    minmax_score: z.coerce.number().optional().nullable(),
    needs_review: z.boolean().optional(),
});

export const adminPatchExampleSchema = z.object({
    sentence: z.string().min(1).optional(),
    blank_sentence: z.string().optional().nullable(),
    target_phrase: z.string().optional().nullable(),
    example_order: z.coerce.number().int().positive().optional(),
    options: z
        .array(
            z.object({
                id: z.coerce.number().int().positive().optional(),
                option_text: z.string().min(1),
                is_correct: z.boolean(),
            })
        )
        .optional(),
});

export const adminCreateOptionSchema = z.object({
    option_text: z.string().min(1, { message: "option_text is required" }),
    is_correct: z.boolean(),
    option_order: z.coerce.number().int().positive().optional(),
});

export const adminReorderExamplesSchema = z.object({
    orderedIds: z
        .array(z.coerce.number().int().positive(), { message: "invalid_ordered_ids" })
        .min(1, { message: "invalid_ordered_ids" }),
});

export const adminReportsQuerySchema = z.object({
    status: z.enum(["pending", "resolved", "dismissed", ""]).optional().default("pending"),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    offset: z.coerce.number().int().min(0).optional().default(0),
});

export const adminPatchReportSchema = z.object({
    status: z.enum(["resolved", "dismissed", "pending"], {
        message: "invalid_status",
    }),
});

// ---------------------------------------------------------------------------
// Agent Schemas
// ---------------------------------------------------------------------------

export const agentChatSchema = z.object({
    message: z
        .string({ message: "missing_message" })
        .trim()
        .min(1, { message: "invalid_message" })
        .max(2000, { message: "invalid_message" }),
    history: z
        .array(
            z.object({
                role: z.enum(["user", "assistant"], { message: "invalid_role" }),
                content: z
                    .string()
                    .min(1, { message: "invalid_history" })
                    .max(4000, { message: "invalid_history" }),
            })
        )
        .optional()
        .default([]),
});

export const agentExplainSchema = z.object({
    example_id: positiveIntParam("example_id"),
    selected_option_id: positiveIntParam("selected_option_id"),
});
