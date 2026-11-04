import { ButtonHTMLAttributes, FC, HTMLAttributes } from 'react';
import { FooterLegendProps } from './FooterLegend';
export type DialogCommonProps = HTMLAttributes<HTMLDivElement>;
export interface DialogButtonProps extends FooterLegendProps, ButtonHTMLAttributes<HTMLButtonElement> {
    /**
     * Enables/disables the focus around the button.
     *
     * Default value depends on context, so setting it to `false` will enable it.
     */
    noFocusRing?: boolean;
    /**
     * Disables the button - assigned `on*` methods will not be invoked if clicked.
     *
     * Depending on where it is, it might still get focus. In such case it can be
     * partially disabled separately.
     *
     * @see focusable.
     */
    disabled?: boolean;
    /**
     * Enables/disables the navigation based focus on button - you won't be able to navigate to
     * it via the gamepad or keyboard.
     *
     * If set to `false`, it still can be clicked and **WILL** become focused until navigated away.
     * Depending on the context of where the button is, even a disabled button can focused.
     */
    focusable?: boolean;
}
/** @component React Components */
export declare const DialogHeader: FC<DialogCommonProps>;
/** @component React Components */
export declare const DialogSubHeader: FC<DialogCommonProps>;
/** @component React Components */
export declare const DialogFooter: FC<DialogCommonProps>;
/** @component React Components */
export declare const DialogLabel: FC<DialogCommonProps>;
/** @component React Components */
export declare const DialogBodyText: FC<DialogCommonProps>;
/** @component React Components */
export declare const DialogBody: FC<DialogCommonProps>;
/** @component React Components */
export declare const DialogControlsSection: FC<DialogCommonProps>;
/** @component React Components */
export declare const DialogControlsSectionHeader: FC<DialogCommonProps>;
/** @component React Components */
export declare const DialogButtonPrimary: FC<DialogButtonProps>;
/** @component React Components */
export declare const DialogButtonSecondary: FC<DialogButtonProps>;
/** @component React Components */
export declare const DialogButton: FC<DialogButtonProps>;
