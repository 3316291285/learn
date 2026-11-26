#!/usr/bin/env node
/**
 * init-sessions.mjs — standalone script
 * Reads state.json (v1) and creates domain subdirectories under sessions/.
 *
 * Usage: node init-sessions.mjs <topic-dir>
 *
 * This file is compiled from src/scripts/init-sessions.mts via tsc and
 * copied into each skill's scripts/ directory by init/update.
 */
import type { StateV1 } from './utils.mjs';
export declare function initSessions(topicDir: string, state: StateV1): number;
//# sourceMappingURL=init-sessions.d.mts.map