#!/usr/bin/env node
/**
 * status.mjs — standalone script
 * Reads state.json (v1) and outputs a formatted learning heatmap to stdout.
 *
 * Usage:
 *   node status.mjs <topic-dir>                    Detailed heatmap (English)
 *   node status.mjs --locale zh-CN <topic-dir>     Detailed heatmap (Chinese)
 *   node status.mjs --all [--locale zh-CN] <dir>   Summary of all topics
 *
 * This file is compiled from src/scripts/status.mts via tsc and
 * copied into learn-anything-status skill's scripts/ directory by init/update.
 */
import type { StateV1 } from './utils.mjs';
type Locale = 'en' | 'zh-CN';
export declare function renderStatus(state: StateV1, now?: number, locale?: Locale): string;
interface TopicSummary {
    topic: string;
    slug: string;
    total: number;
    mastered: number;
    active: number;
    practice: number;
    unexplored: number;
    pct: number;
    lastPracticed: string | null;
    days: number;
}
export declare function renderAllTopics(summaries: TopicSummary[], now?: number, locale?: Locale): string;
export {};
//# sourceMappingURL=status.d.mts.map