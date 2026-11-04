import * as React from 'react';
import { Ref } from 'react';
declare global {
    interface Window {
        SP_REACT: typeof React;
        SP_REACTDOM: any;
        SP_JSX_FACTORY: any;
    }
}
/**
 * Create a Regular Expression to search for a React component that uses certain props in order.
 *
 * @param {string[]} propList Ordererd list of properties to search for
 * @returns {RegExp} RegEx to call .test(component.toString()) on
 */
export declare function createPropListRegex(propList: string[], fromStart?: boolean): RegExp;
export declare function applyHookStubs(customHooks?: any): any;
export declare function removeHookStubs(): void;
export declare function fakeRenderComponent(fun: Function, customHooks?: any): any;
export declare function wrapReactType(node: any, prop?: any): any;
export declare function wrapReactClass(node: any, prop?: any): any;
export declare function getReactRoot(o: HTMLElement | Element | Node): any;
export declare function getReactInstance(o: HTMLElement | Element | Node): any;
export interface findInTreeOpts {
    walkable?: string[];
    ignore?: string[];
}
export declare type findInTreeFilter = (element: any) => boolean;
export declare const findInTree: (parent: any, filter: findInTreeFilter, opts: findInTreeOpts) => any;
export declare const findInReactTree: (node: any, filter: findInTreeFilter) => any;
/**
 * Finds the parent window of a DOM element
 */
export declare function getParentWindow<WindowType = Window>(elem: HTMLElement | null): WindowType | null | undefined;
/**
 * React hook to find the host window of a component
 * Pass the returned ref into a React element and window will be its host window.
 * @returns [ref, window]
 */
export declare function useWindowRef<RefElementType extends HTMLElement, WindowType = Window>(): [Ref<RefElementType>, WindowType | null | undefined];
