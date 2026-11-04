declare global {
    interface Window {
        webpackChunksteamui: any;
    }
}
export type ModuleID = string;
export type Module = any;
export type Export = any;
type FilterFn = (module: any) => boolean;
type ExportFilterFn = (moduleExport: any, exportName?: any) => boolean;
type FindFn = (module: any) => any;
export declare let modules: Map<string, any>;
export declare function isCssHash(hash: string): boolean;
export declare function firstClass(value: string): string;
export declare function isClassModule(m: Module): boolean;
export declare const findModule: (filter: FilterFn) => any;
export declare const findModuleDetailsByExport: (filter: ExportFilterFn, minExports?: number) => [module: Module | undefined, moduleExport: any, exportName: any, moduleID: string | undefined];
export declare const findModuleByExport: (filter: ExportFilterFn, minExports?: number) => any;
export declare const findModuleExport: (filter: ExportFilterFn, minExports?: number) => any;
/**
 * @deprecated use findModuleExport instead
 */
export declare const findModuleChild: (filter: FindFn) => any;
/**
 * @deprecated use createModuleMapping instead
 */
export declare const findAllModules: (filter: FilterFn) => any[];
export declare const createModuleMapping: (filter: FilterFn) => Map<string, any>;
export declare const CommonUIModule: any;
export declare const ReactRouter: any;
export {};
