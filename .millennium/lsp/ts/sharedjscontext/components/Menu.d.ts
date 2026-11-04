import { FC, ReactNode } from 'react';
import { FooterLegendProps } from './FooterLegend';
interface PopupCreationOptions {
    /**
     * Initially hidden, make it appear with {@link ContextMenuInstance.Show}.
     */
    bCreateHidden?: boolean;
    bModal?: boolean;
    /**
     * Document title.
     */
    title?: string;
}
interface MonitorOptions {
    targetMonitor: {
        flMonitorScale: number;
        nScreenLeft: number;
        nScreenTop: number;
        nScreenWidth: number;
        nScreenHeight: number;
    };
    flGamepadScale: number;
}
export interface ContextMenuPositionOptions extends PopupCreationOptions, Partial<MonitorOptions> {
    /**
     * When {@link bForcePopup} is true, makes the window appear above everything else.
     */
    bAlwaysOnTop?: boolean;
    /**
     * Disables the mouse overlay, granting the ability to click anywhere while
     * the menu's active.
     */
    bDisableMouseOverlay?: boolean;
    /**
     * Disables the {@link bPreferPopTop} behavior.
     */
    bDisablePopTop?: boolean;
    bFitToWindow?: boolean;
    /**
     * Forces the menu to open in a separate window instead of inside the parent.
     */
    bForcePopup?: boolean;
    /**
     * Like {@link bMatchWidth}, but don't shrink below the menu's minimum width.
     */
    bGrowToElementWidth?: boolean;
    /**
     * Match the parent's exact height.
     */
    bMatchHeight?: boolean;
    /**
     * Match the parent's exact width.
     */
    bMatchWidth?: boolean;
    bNoFocusWhenShown?: boolean;
    /**
     * Makes the menu **invisible**, instead of getting removed from the DOM.
     */
    bRetainOnHide?: boolean;
    bScreenCoordinates?: boolean;
    /**
     * Set to `true` to not account for the parent's width.
     */
    bOverlapHorizontal?: boolean;
    /**
     * Set to `true` to not account for the parent's height.
     */
    bOverlapVertical?: boolean;
    /**
     * Set to `true` to make the entire menu try to appear on the left side from
     * the parent.
     */
    bPreferPopLeft?: boolean;
    /**
     * Set to `true` to make the entire menu try to appear above the parent.
     */
    bPreferPopTop?: boolean;
    bShiftToFitWindow?: boolean;
    bStandalone?: boolean;
    /**
     * Class name **replacement** for the container element, i.e. it replaces the
     * default class.
     */
    strClassName?: string;
}
export interface ContextMenuInstance {
    Hide(): void;
    Show(): void;
}
export declare const showContextMenu: (children: ReactNode, parent?: EventTarget, options?: ContextMenuPositionOptions) => ContextMenuInstance;
export interface MenuProps extends FooterLegendProps {
    label: string;
    onCancel?(): void;
    cancelText?: string;
    children?: ReactNode;
}
/** @component React Components */
export declare const Menu: FC<MenuProps>;
export interface MenuGroupProps {
    label: string;
    disabled?: boolean;
    children?: ReactNode;
}
/** @component React Components */
export declare const MenuGroup: FC<MenuGroupProps>;
export interface MenuItemProps extends FooterLegendProps {
    bInteractableItem?: boolean;
    onClick?(evt: Event): void;
    onSelected?(evt: Event): void;
    onMouseEnter?(evt: MouseEvent): void;
    onMoveRight?(): void;
    selected?: boolean;
    disabled?: boolean;
    bPlayAudio?: boolean;
    tone?: 'positive' | 'emphasis' | 'destructive';
    children?: ReactNode;
}
/** @component React Components */
export declare const MenuItem: FC<MenuItemProps>;
/** @component React Components */
export declare const MenuSeparator: FC;
export {};
