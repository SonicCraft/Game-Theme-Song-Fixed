import { FunctionComponent } from 'react';
import { ValveReactErrorInfo } from '../hooks/error-from-source';
interface MillenniumErrorBoundaryProps {
    error: ValveReactErrorInfo;
    errorKey: string;
    identifier: string;
    reset: () => void;
}
declare global {
    interface Window {
        SystemNetworkStore?: any;
    }
}
declare const MillenniumErrorBoundary: FunctionComponent<MillenniumErrorBoundaryProps>;
export default MillenniumErrorBoundary;
