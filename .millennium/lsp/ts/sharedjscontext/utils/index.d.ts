export * from './patcher';
export * from './react/react';
export * from './react/fc';
export * from './react/treepatcher';
export * from './static-classes';
declare global {
    var FocusNavController: any;
    var GamepadNavTree: any;
}
export declare function joinClassNames(...classes: string[]): string;
export declare function sleep(ms: number): Promise<unknown>;
/**
 * Finds the SP window, since it is a render target as of 10-19-2022's beta
 */
export declare function findSP(): Window;
/**
 * Gets the correct FocusNavController, as the Feb 22 2023 beta has two for some reason.
 */
export declare function getFocusNavController(): any;
/**
 * Gets the gamepad navigation trees as Valve seems to be moving them.
 */
export declare function getGamepadNavigationTrees(): any;
