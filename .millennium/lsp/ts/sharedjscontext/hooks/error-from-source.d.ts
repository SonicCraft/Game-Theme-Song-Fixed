import { ErrorInfo } from 'react';
export interface ValveReactErrorInfo {
    error: Error;
    info: ErrorInfo;
}
export interface ValveError {
    identifier: string;
    identifierHash: string;
    message: string | [func: string, src: string, line: number, column: number];
}
export type ErrorSource = [source: string, wasPlugin: boolean, shouldReportToValve: boolean];
export declare function getLikelyErrorSourceFromValveError(error: ValveError): ErrorSource;
export declare function getLikelyErrorSourceFromValveReactError(error: ValveReactErrorInfo): ErrorSource;
export declare function getLikelyErrorSource(error?: string): ErrorSource;
