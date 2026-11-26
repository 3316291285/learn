/**
 * utils.mts — shared types, validation, and helpers for scripts.
 *
 * This file is compiled from src/scripts/utils.mts via tsc and
 * copied into each skill's scripts/ directory by init/update.
 * It MUST NOT import any project modules — only Node.js built-ins.
 */
export type ConceptStatus = 'unexplored' | 'in_progress' | 'needs_practice' | 'mastered';
export interface Concept {
    name: string;
    slug: string;
    status: ConceptStatus;
    confidence: number;
    practice_count: number;
    explain_count: number;
    last_explained: string | null;
    last_practiced: string | null;
    details: string[];
}
export interface Domain {
    name: string;
    slug: string;
    concepts: Concept[];
}
export interface StateV1 {
    version: 1;
    topic: string;
    slug: string;
    created: string;
    domains: Domain[];
}
export declare const STATUS_ICON: Record<ConceptStatus, string>;
export declare const STATUS_LABEL: Record<ConceptStatus, string>;
/** Escape underscores in text destined for Markdown output. */
export declare const esc: (s: string) => string;
export interface ValidationError {
    path: string;
    message: string;
}
export declare function validateStateV1(data: unknown): ValidationError[];
export type QuestionType = 'multiple_choice' | 'multi_select' | 'true_false' | 'fill_in_blank' | 'error_correction';
export type QuestionGradeable = 'exact' | 'accepted' | 'ai_only';
export interface QuizQuestion {
    id: string;
    type: QuestionType;
    gradeable: QuestionGradeable;
    prompt: string;
    explanation: string;
    options?: string[];
    answer: string | boolean | string[];
    accepted_answers?: string[];
}
export interface QuizDeck {
    version: 1;
    topic: string;
    topic_slug: string;
    concept_slug: string;
    concept_name: string;
    created: string;
    questions: QuizQuestion[];
}
export declare function validateQuizDeck(data: unknown): ValidationError[];
export declare function totalCount(state: StateV1): number;
export declare function masteredCount(state: StateV1): number;
//# sourceMappingURL=utils.d.mts.map