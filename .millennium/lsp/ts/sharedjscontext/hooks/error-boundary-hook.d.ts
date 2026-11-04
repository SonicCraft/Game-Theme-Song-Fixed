import { Logger } from '../logger';
declare global {
    interface Window {
        __ERRORBOUNDARY_HOOK_INSTANCE: ErrorBoundaryHook;
    }
}
declare class ErrorBoundaryHook extends Logger {
    private errorBoundaryPatch?;
    private errorCheckPatch?;
    doNotReportErrors: boolean;
    private disableReportingTimer;
    constructor();
    temporarilyDisableReporting(): void;
    deinit(): void;
}
export default ErrorBoundaryHook;
