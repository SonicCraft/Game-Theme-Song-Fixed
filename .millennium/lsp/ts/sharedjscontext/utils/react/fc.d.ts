import { type FC } from 'react';
export interface FCTrampoline {
    component: FC;
}
export declare function setFCTrampolineLoggingEnabled(value?: boolean): void;
/**
 * Directly hooks a function component from its reference, redirecting it to a user-patchable wrapper in its returned object.
 * This only works if the original component when called directly returns either nothing, null, or another child element.
 *
 * This works by tricking react into thinking it's a class component by cleverly working around its class component checks,
 * keeping the unmodified function component intact as a mostly working constructor (as it is impossible to direcly modify a function),
 * stubbing out hooks to prevent errors by detecting setter/getter triggers that occur direcly before/after the class component is instantiated by react,
 * and creating a fake class component render method to trampoline out into your own handler.
 *
 * Due to the nature of this method of hooking a component, please only use this where it is *absolutely necessary.*
 * Incorrect hook stubs can cause major instability, be careful when writing them. Refer to fakeRenderComponent for the hook stub implementation.
 * Make sure your hook stubs can handle all the cases they could possibly need to within the component you are injecting into.
 * You do not need to worry about its children, as they are never called due to the first instance never actually rendering.
 */
export declare function injectFCTrampoline(component: FC, customHooks?: any): FCTrampoline;
