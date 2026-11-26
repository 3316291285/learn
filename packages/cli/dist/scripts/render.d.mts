#!/usr/bin/env node
/**
 * render.mjs — standalone script
 * Reads state.json (v1) and renders knowledge-map.md.
 *
 * Usage: node render.mjs <topic-dir>
 *
 * This file is compiled from src/scripts/render.mts via tsc and
 * copied into each skill's scripts/ directory by init/update.
 */
import type { StateV1 } from './utils.mjs';
export declare function render(state: StateV1): string;
//# sourceMappingURL=render.d.mts.map