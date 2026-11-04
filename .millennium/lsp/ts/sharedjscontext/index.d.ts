export * from './class-mapper';
export * from './error-monitor';
export * from './components';
export * from './custom-components';
export * from './custom-hooks';
export * from './deck-hooks';
export * from './globals';
export * from './modules';
export * from './constSysfsExpr';
export * from './utils';
export * from './webpack';
export * from './logger';
import { JSX } from 'react';
import ErrorBoundaryHook from './hooks/error-boundary-hook';
import RouterHook from './hooks/router/router-hook';
import Toaster from './hooks/toaster-hook';
export declare const errorBoundaryHook: ErrorBoundaryHook;
export declare const routerHook: RouterHook;
export declare const toaster: Toaster;
export interface Plugin {
    version?: string;
    icon: JSX.Element;
    content?: JSX.Element;
    onDismount?(): void;
    alwaysRender?: boolean;
    titleView?: JSX.Element;
}
export type DefinePluginFn = () => Plugin | Promise<Plugin>;
export declare const definePlugin: (fn: DefinePluginFn) => DefinePluginFn;
