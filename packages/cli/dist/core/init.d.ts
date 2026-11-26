import type { SupportedLocale } from '../i18n/types.js';
type InitCommandOptions = {
    tools?: string;
    force?: boolean;
    locale?: SupportedLocale;
    update?: boolean;
    context7?: boolean;
};
export declare class InitCommand {
    private readonly toolsArg?;
    private readonly force;
    private readonly locale;
    private readonly isUpdate;
    private readonly context7Arg?;
    private context7Enabled;
    constructor(options?: InitCommandOptions);
    execute(targetPath?: string): Promise<void>;
    private promptContext7;
    private detectTools;
    private hasToolDir;
    private interactiveSelect;
    private generateSkillsForTool;
    /** Read a compiled script from dist/scripts/ (bundled alongside this module). */
    private readCompiledScript;
    private generateCommandsForTool;
}
export {};
//# sourceMappingURL=init.d.ts.map