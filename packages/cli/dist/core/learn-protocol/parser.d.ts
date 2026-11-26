/**
 * Markdown parser for v0 knowledge-map.md.
 *
 * Uses unified + remark-parse to extract the hierarchical structure
 * (domains -> concepts -> details) from the v0 knowledge-map format.
 *
 * This is used ONLY during migration (init/update), not at AI runtime.
 *
 * v0 knowledge-map.md format:
 *
 * ```md
 * # Topic Name
 * ## Domain 1
 * - Concept A
 *   - Detail A1
 *   - Detail A2
 * - Concept B
 * ## Domain 2
 * - Concept C
 * ```
 */
import type { ParsedKnowledgeMap } from './types.js';
/**
 * Parse a v0 knowledge-map.md file content into a structured representation.
 *
 * The parser walks the mdast tree:
 * - `# Title` (h1) -> topic name
 * - `## DomainName` (h2) -> start a new domain
 * - `- Concept` (top-level list item) -> add concept to current domain
 * - `  - Detail` (nested list item) -> add detail to preceding concept
 */
export declare function parseKnowledgeMap(markdown: string): ParsedKnowledgeMap;
//# sourceMappingURL=parser.d.ts.map