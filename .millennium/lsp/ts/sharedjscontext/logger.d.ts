export declare class Logger {
    log: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
    constructor(name: string, moduleName?: string);
}
