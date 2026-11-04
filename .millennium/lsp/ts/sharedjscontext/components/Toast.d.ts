import { FC, ReactNode } from 'react';
export declare enum ToastLocation {
    /** Big Picture popup toasts */
    GAMEPADUI_POPUP = 1,
    /** QAM Notifications tab */
    GAMEPADUI_QAM = 3
}
export interface ToastData {
    title: ReactNode;
    body: ReactNode;
    subtext?: ReactNode;
    logo?: ReactNode;
    icon?: ReactNode;
    timestamp?: Date;
    onClick?: () => void;
    className?: string;
    contentClassName?: string;
    /** ms before toast popup is hidden. defaults to 5 seconds */
    duration?: number;
    /** ms before toast is removed from the tray. Valve's logic will always remove all toasts 48h after they are first viewed regardless of this value */
    expiration?: number;
    critical?: boolean;
    eType?: number;
    sound?: number;
    /** Hidden 10min after first viewed */
    showNewIndicator?: boolean;
    playSound?: boolean;
    showToast?: boolean;
}
interface ToastProps {
    toast: ToastData;
    newIndicator?: boolean;
}
interface ToastRendererProps extends ToastProps {
    location: ToastLocation;
}
/** @hide @internal This is not meant for external use */
export declare const ToastRenderer: FC<ToastRendererProps>;
export default ToastRenderer;
