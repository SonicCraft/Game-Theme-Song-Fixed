import { FC, ReactNode } from 'react';
export interface ControlsListProps {
    alignItems?: 'left' | 'right' | 'center';
    spacing?: 'standard' | 'extra';
    children?: ReactNode;
}
/** @component React Components */
export declare const ControlsList: FC<ControlsListProps>;
