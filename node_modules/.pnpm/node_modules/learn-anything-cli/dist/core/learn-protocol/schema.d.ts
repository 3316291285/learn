import { z } from 'zod';
export declare const stateV1Schema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    topic: z.ZodString;
    slug: z.ZodString;
    created: z.ZodString;
    domains: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        slug: z.ZodString;
        concepts: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            slug: z.ZodString;
            status: z.ZodEnum<{
                unexplored: "unexplored";
                in_progress: "in_progress";
                needs_practice: "needs_practice";
                mastered: "mastered";
            }>;
            confidence: z.ZodNumber;
            practice_count: z.ZodNumber;
            explain_count: z.ZodNumber;
            last_explained: z.ZodNullable<z.ZodString>;
            last_practiced: z.ZodNullable<z.ZodString>;
            details: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type StateV1Schema = z.infer<typeof stateV1Schema>;
export type ValidationResult = {
    success: true;
    data: StateV1Schema;
} | {
    success: false;
    errors: z.ZodIssue[];
};
/** Validate an unknown value against the StateV1 schema. */
export declare function validateStateV1(value: unknown): ValidationResult;
//# sourceMappingURL=schema.d.ts.map