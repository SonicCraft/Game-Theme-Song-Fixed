import { ReactNode, FC } from 'react';
import { ItemProps } from './Item';
export interface ProgressBarItemProps extends ItemProps {
    indeterminate?: boolean;
    nTransitionSec?: number;
    nProgress?: number;
    focusable?: boolean;
}
export interface ProgressBarProps {
    indeterminate?: boolean;
    nTransitionSec?: number;
    nProgress?: number;
    focusable?: boolean;
}
export interface ProgressBarWithInfoProps extends ProgressBarItemProps {
    sTimeRemaining?: ReactNode;
    sOperationText?: ReactNode;
}
/** @component React Components */
export declare const ProgressBar: FC<ProgressBarProps>;
/** @component React Components */
export declare const ProgressBarWithInfo: FC<ProgressBarWithInfoProps>;
/** @component React Components */
export declare const ProgressBarItem: FC<ProgressBarItemProps>;
