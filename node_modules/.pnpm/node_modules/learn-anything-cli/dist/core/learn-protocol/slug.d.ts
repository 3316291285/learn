/**
 * Generate a stable kebab-case slug from a human-readable name.
 *
 * Rules (applied in order):
 * 1. Replace `/` with `-`
 * 2. Replace spaces with `-`
 * 3. Remove characters that are NOT letters, digits, `-`, or `_`
 * 4. Convert ASCII letters to lowercase; preserve non-ASCII characters
 * 5. Collapse consecutive `-` into a single `-`
 * 6. Trim leading / trailing `-`
 */
export declare function generateSlug(name: string): string;
//# sourceMappingURL=slug.d.ts.map