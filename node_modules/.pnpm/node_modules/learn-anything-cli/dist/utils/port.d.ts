export declare const DEFAULT_PORT = 24278;
export declare const DEFAULT_MAX_ATTEMPTS = 50;
/**
 * Test whether a TCP port is free to bind.
 *
 * Probes without binding a specific host so the check matches the behaviour of
 * `server.listen(port)` used by the dev server (which listens on the wildcard
 * address). The probe socket is unreffed so it never keeps the process alive.
 */
export declare function isPortFree(port: number): Promise<boolean>;
/**
 * Find the first free port starting from `startPort`, incrementing one at a
 * time up to `maxAttempts` (inclusive of the start port). Throws when the
 * whole range is occupied.
 */
export declare function findFreePort(startPort: number, maxAttempts?: number): Promise<number>;
//# sourceMappingURL=port.d.ts.map