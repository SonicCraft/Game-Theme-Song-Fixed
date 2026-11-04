export declare let callOriginal: symbol;
export interface PatchOptions {
    singleShot?: boolean;
}
export type GenericPatchHandler = (args: any[], ret?: any) => any;
export interface Patch<Object extends Record<PropertyKey, any> = Record<PropertyKey, any>, Property extends keyof Object = keyof Object, Target extends Object[Property] = Object[Property]> {
    object: Object;
    property: Property;
    original: Target;
    patchedFunction: Target;
    hasUnpatched: boolean;
    handler: ((args: Parameters<Target>, ret: ReturnType<Target>) => any) | ((args: Parameters<Target>) => any);
    unpatch(): void;
}
export declare function beforePatch<Object extends Record<PropertyKey, any>, Property extends keyof Object, Target extends Object[Property]>(object: Object, property: Property, handler: (args: Parameters<Target>) => void, options?: PatchOptions): Patch<Object, Property, Target>;
export declare function afterPatch<Object extends Record<PropertyKey, any>, Property extends keyof Object, Target extends Object[Property]>(object: Object, property: Property, handler: (args: Parameters<Target>, ret: ReturnType<Target>) => ReturnType<Target>, options?: PatchOptions): Patch<Object, Property, Target>;
export declare function replacePatch<Object extends Record<PropertyKey, any>, Property extends keyof Object, Target extends Object[Property]>(object: Object, property: Property, handler: (args: Parameters<Target>) => ReturnType<Target>, options?: PatchOptions): Patch<Object, Property, Target>;
