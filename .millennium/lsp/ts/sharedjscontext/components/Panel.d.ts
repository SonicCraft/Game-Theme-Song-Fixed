import { FC, ReactNode } from 'react';
export interface PanelSectionProps {
    title?: string;
    spinner?: boolean;
    children?: ReactNode;
}
/** @component React Components */
export declare const PanelSection: FC<PanelSectionProps>;
export interface PanelSectionRowProps {
    children?: ReactNode;
}
/** @component React Components */
export declare const PanelSectionRow: FC<PanelSectionRowProps>;
