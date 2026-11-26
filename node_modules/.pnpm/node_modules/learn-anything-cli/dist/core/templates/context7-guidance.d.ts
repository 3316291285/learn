/**
 * Context7 documentation verification guidance.
 * Injected into topic/explain/practice skill templates when Context7 is enabled.
 *
 * Instructs the AI to use Context7 MCP tools at runtime:
 * - resolve-library-id: resolves library name to Context7 ID
 * - query-docs: fetches docs by library ID + query
 *
 * NOT injected into review/status templates (those are about progress review
 * and visualization, not teaching content).
 */
export declare const CONTEXT7_GUIDANCE = "\n## Documentation Verification (Context7)\n\nWhen teaching about a specific library or framework, verify your explanations against official documentation using Context7 MCP tools:\n\n1. **Resolve the library**: Call `resolve-library-id` with the library name (e.g., \"React\", \"TypeScript\")\n2. **Fetch relevant docs**: Call `query-docs` with the resolved library ID and the concept you are teaching as the query\n3. **Cross-reference**: Ensure your explanations, code examples, and API usage match the official documentation\n4. **Defer to docs**: If your explanation conflicts with official documentation, use the official documentation as the authoritative source\n\nIf Context7 MCP tools are not available in your environment, proceed with your built-in knowledge.\n";
//# sourceMappingURL=context7-guidance.d.ts.map