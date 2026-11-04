import { Logger } from '../logger';
import { ReactNode } from 'react';
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
export interface ToastNotification {
    data: ToastData;
    dismiss: () => void;
}
declare global {
    interface Window {
        __TOASTER_INSTANCE: any;
        settingsStore: any;
        NotificationStore: any;
    }
}
declare class Toaster extends Logger {
    private toastPatch?;
    constructor();
    toast(toast: ToastData): ToastNotification;
    deinit(): void;
}
export default Toaster;
