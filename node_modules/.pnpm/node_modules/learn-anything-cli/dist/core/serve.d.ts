import type { SupportedLocale } from '../i18n/types.js';
export interface ServeOptions {
    targetPath?: string;
    port?: number;
    strictPort?: boolean;
    open?: boolean;
    locale?: SupportedLocale;
}
export declare function executeServe(options: ServeOptions): Promise<void>;
//# sourceMappingURL=serve.d.ts.map