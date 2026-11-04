import { ComponentType, FC, ReactNode } from 'react';
import type { RouteProps } from 'react-router';
import { EUIMode } from '../../globals/steam-client/shared';
export interface RouterEntry {
    props: Omit<RouteProps, 'path' | 'children'>;
    component: ComponentType;
}
export type RoutePatch = (route: RouteProps) => RouteProps;
interface PublicMillenniumRouterState {
    routes: Map<string, RouterEntry>;
    routePatches: Map<EUIMode, Map<string, Set<RoutePatch>>>;
}
export declare class MillenniumRouterState {
    private _routes;
    private _routePatches;
    eventBus: EventTarget;
    publicState(): PublicMillenniumRouterState;
    addRoute(path: string, component: RouterEntry['component'], props?: RouterEntry['props']): void;
    addPatch(path: string, patch: RoutePatch, uiMode: EUIMode): RoutePatch;
    removePatch(path: string, patch: RoutePatch, uiMode: EUIMode): void;
    removeRoute(path: string): void;
    private notifyUpdate;
}
interface MillenniumRouterStateContext extends PublicMillenniumRouterState {
    addRoute(path: string, component: RouterEntry['component'], props: RouterEntry['props']): void;
    addPatch(path: string, patch: RoutePatch, uiMode?: EUIMode): RoutePatch;
    removePatch(path: string, patch: RoutePatch, uiMode?: EUIMode): void;
    removeRoute(path: string): void;
}
declare const MillenniumRouterStateContext: import("react").Context<MillenniumRouterStateContext>;
export declare const useMillenniumRouterState: () => MillenniumRouterStateContext;
interface Props {
    millenniumRouterState: MillenniumRouterState;
    children: ReactNode;
}
export declare const MillenniumRouterStateContextProvider: FC<Props>;
export {};
