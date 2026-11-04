import ProtocolMapping from 'devtools-protocol/types/protocol-mapping';
declare global {
    interface Window {
        PLUGIN_LIST: any;
        MILLENNIUM_BACKEND_IPC: typeof backendIPC;
        MILLENNIUM_IPC_SOCKET: WebSocket;
        CURRENT_IPC_CALL_COUNT: number;
        MILLENNIUM_PLUGIN_SETTINGS_STORE: any;
        MILLENNIUM_API: any;
        MILLENNIUM_PRIVATE_INTERNAL_FOREIGN_FUNCTION_INTERFACE_DO_NOT_USE: FFI_Binder;
    }
}
declare const backendIPC: {
    postMessage: (messageId: number, contents: any) => Promise<any>;
};
declare enum IpcMethod {
    CALL_SERVER_METHOD = 0,
    FRONT_END_LOADED = 1,
    CALL_FRONTEND_METHOD = 2,
    PLUGIN_CONFIG = 3
}
interface ResponsePayload {
    success: boolean;
    returnJson?: any;
    error?: string;
}
declare class FFI_Binder {
    private pendingRequests;
    private nextId;
    private static rejectWithCallSite;
    /** Capture the full call stack. */
    private getCaller;
    call(payloadType: IpcMethod, pluginName: string, methodName: string | number, argumentList: any, callSite?: Error, raw?: boolean): Promise<any>;
    __handleResponse(requestId: number, response: ResponsePayload): void;
    destroy(): void;
}
export declare const Millennium: {
    AddWindowCreateHook?: ((cb: any) => void) | undefined;
    callServerMethod: (pluginName: string, methodName: string, kwargs?: any, callSite?: Error) => Promise<any>;
    findElement: (doc: Document, selector: string, timeout?: number) => Promise<NodeListOf<Element>>;
    exposeObj: <T extends object>(exportsOrObj: any, obj?: T) => any;
    openQuickAccess: (target?: {
        plugin: string;
    } | {
        theme: string;
    }) => Promise<void>;
};
export declare function callable<Params extends [params: Record<string, unknown>] | [] = [], Return = unknown>(route: string): (...params: Params) => Promise<Return>;
export declare function callable<Params extends [params: Record<string, unknown>] | [] = [], Return = unknown>(pluginName: string, route: string): (...params: Params) => Promise<Return>;
export declare function ffi<Params extends unknown[] = unknown[], Return = unknown>(route: string): (...params: Params) => Promise<Return>;
export declare function ffi<Params extends unknown[] = unknown[], Return = unknown>(pluginName: string, route: string): (...params: Params) => Promise<Return>;
export declare const pluginSelf: any;
export declare function BindPluginSettings(): any;
export declare function BindPluginSettings(pluginName: string): any;
type ConfigChangeCallback = (key: string, value: any) => void;
export declare function subscribePluginConfig(cb: ConfigChangeCallback): () => void;
export declare function subscribePluginConfig(pluginName: string, cb: ConfigChangeCallback): () => void;
export declare const pluginConfig: {
    get: <T = any>(pluginNameOrKey: string, key?: string) => Promise<T>;
    set: (pluginNameOrKey: string, keyOrValue?: string, value?: any) => Promise<void>;
    delete: (pluginNameOrKey: string, key?: string) => Promise<void>;
    getAll: <T = Record<string, any>>(pluginName?: string) => Promise<T>;
};
export declare function usePluginConfig<T = any>(key?: string): [T | undefined, (...args: any[]) => Promise<void>];
export declare function usePluginConfig<T = any>(pluginName: string, key?: string): [T | undefined, (...args: any[]) => Promise<void>];
export type QuickAccessTarget = {
    plugin: string;
} | {
    theme: string;
};
declare const CDP_PROXY_BINDING = "__millennium_cdp_proxy__";
declare const CDP_EXTENSION_BINDING = "__millennium_extension_route__";
declare const CDP_EXT_RESP = "MILLENNIUM_CHROME_DEV_TOOLS_PROTOCOL_DO_NOT_USE_OR_OVERRIDE_ONMESSAGE";
declare global {
    interface Window {
        [CDP_EXT_RESP]: {
            __handleCDPResponse: (response: any) => void;
        };
        [CDP_EXTENSION_BINDING]: (message: string) => void;
        [CDP_PROXY_BINDING]: (message: string) => void;
        __millennium_cdp_resolve__: (callbackId: number, result: any) => void;
        __millennium_cdp_reject__: (callbackId: number, error: string) => void;
        __millennium_cdp_event__: (data: any) => void;
    }
}
export declare class MillenniumChromeDevToolsProtocol {
    protected readonly _pluginName: string;
    eventListeners: Map<string, Set<(params: any) => void>>;
    private readonly _eventDispatcher;
    constructor(pluginName: string);
    on<T extends keyof ProtocolMapping.Events>(event: T, listener: (params: ProtocolMapping.Events[T][0] & {
        sessionId?: string;
    }) => void): () => void;
    off<T extends keyof ProtocolMapping.Events>(event: T, listener: (params: ProtocolMapping.Events[T][0] & {
        sessionId?: string;
    }) => void): void;
    send<T extends keyof ProtocolMapping.Commands>(method: T, params?: ProtocolMapping.Commands[T]['paramsType'][0], sessionId?: string): Promise<ProtocolMapping.Commands[T]['returnType']>;
    protected _sendViaExtensionRoute<T extends keyof ProtocolMapping.Commands>(method: T, params: ProtocolMapping.Commands[T]['paramsType'][0], sessionId?: string): Promise<ProtocolMapping.Commands[T]['returnType']>;
}
export declare const ChromeDevToolsProtocol: MillenniumChromeDevToolsProtocol;
export {};
