import { FC, ReactNode } from 'react';
import { EUIMode } from '../../globals/steam-client/shared';
interface PublicMillenniumGlobalComponentsState {
    components: Map<EUIMode, Map<string, FC>>;
}
export declare class MillenniumGlobalComponentsState {
    private _components;
    eventBus: EventTarget;
    publicState(): PublicMillenniumGlobalComponentsState;
    addComponent(path: string, component: FC, uiMode: EUIMode): void;
    removeComponent(path: string, uiMode: EUIMode): void;
    private notifyUpdate;
}
interface MillenniumGlobalComponentsContext extends PublicMillenniumGlobalComponentsState {
    addComponent(path: string, component: FC, uiMode: EUIMode): void;
    removeComponent(path: string, uiMode: EUIMode): void;
}
declare const MillenniumGlobalComponentsContext: import("react").Context<MillenniumGlobalComponentsContext>;
export declare const useMillenniumGlobalComponentsState: () => MillenniumGlobalComponentsContext;
interface Props {
    millenniumGlobalComponentsState: MillenniumGlobalComponentsState;
    children: ReactNode;
}
export declare const MillenniumGlobalComponentsStateContextProvider: FC<Props>;
export {};
