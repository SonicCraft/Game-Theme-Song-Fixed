import { FC } from 'react';
import { RoutePatch, RouterEntry } from './MillenniumRouterState';
import { Logger } from '../../logger';
import { EUIMode } from '../../globals/steam-client/shared';
declare global {
    interface Window {
        __ROUTER_HOOK_INSTANCE: any;
    }
}
declare class RouterHook extends Logger {
    private routerState;
    private globalComponentsState;
    private renderedComponents;
    private Route;
    private DesktopRoute;
    private wrappedDesktopLibraryMemo?;
    private MillenniumGamepadRouterWrapper;
    private MillenniumDesktopRouterWrapper;
    private MillenniumGlobalComponentsWrapper;
    private toReplace;
    private desktopRouterPatch?;
    private gamepadRouterPatch?;
    private modeChangeRegistration?;
    private patchedModes;
    routes?: any[];
    private setupListeners;
    private isSetupEmitted;
    constructor();
    private patchGamepadRouter;
    private patchDesktopRouter;
    emitRouterSetup(): Promise<void>;
    registerForRouterSetup(callback: () => void): Promise<void>;
    waitForUnlock(): Promise<void>;
    handleDesktopRouterRender(_: any, ret: any): any;
    handleGamepadRouterRender(_: any, ret: any): any;
    private globalComponentsWrapper;
    private gamepadRouterWrapper;
    private desktopRouterWrapper;
    private processList;
    addRoute(path: string, component: RouterEntry['component'], props?: RouterEntry['props']): void;
    addPatch(path: string, patch: RoutePatch, uiMode?: EUIMode): RoutePatch;
    addGlobalComponent(name: string, component: FC, uiMode?: EUIMode): void;
    removeGlobalComponent(name: string, uiMode?: EUIMode): void;
    removePatch(path: string, patch: RoutePatch, uiMode?: EUIMode): void;
    removeRoute(path: string): void;
    deinit(): void;
}
export default RouterHook;
