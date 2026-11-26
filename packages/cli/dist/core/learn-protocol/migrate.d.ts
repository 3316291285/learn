/**
 * v0 -> v1 migration logic.
 *
 * Detects v0 state.yaml format and merges it with knowledge-map.md
 * to produce a state.json v1 file. Migration is idempotent and
 * creates .bak backups before writing.
 *
 * Migration chain:
 *   state.yaml (v0) + knowledge-map.md (v0)
 *     -> migrateV0ToV1()
 *       -> state.json (v1) + state.yaml.v0.bak + knowledge-map.md.v0.bak
 */
import type { V0State } from './types.js';
/**
 * Check if a parsed YAML object matches the v0 state format.
 *
 * v0 is identified by having `topic` and `concepts` fields but
 * NO `version` field. Returns `true` when the data matches v0.
 */
export declare function isV0State(data: unknown): data is V0State;
export interface MigrationResult {
    migrated: boolean;
    topic: string;
    reason?: 'already_migrated' | 'already_v1' | 'not_v0' | 'no_state_yaml' | 'error';
    error?: string;
}
export interface MigrationReport {
    migratedCount: number;
    skippedCount: number;
    results: MigrationResult[];
}
/**
 * Migrate a single topic directory from v0 to v1.
 *
 * Reads `state.yaml` and `knowledge-map.md`, merges them into `state.json`,
 * and creates `.bak` backup files. Idempotent — skips if already migrated.
 *
 * @param topicDir — Absolute path to the topic directory (e.g. `.learn/topics/javascript`)
 * @returns A MigrationResult describing what happened
 */
export declare function migrateV0ToV1(topicDir: string): Promise<MigrationResult>;
/**
 * Migrate ALL topics under a base directory from v0 to v1.
 *
 * Scans `.learn/topics/` for topic subdirectories and runs
 * migrateV0ToV1 on each one. Returns a summary report.
 *
 * @param baseDir — Path to the topics directory (e.g. `.learn/topics`)
 * @returns MigrationReport with counts and per-topic results
 */
export declare function migrateAll(baseDir: string): Promise<MigrationReport>;
//# sourceMappingURL=migrate.d.ts.map