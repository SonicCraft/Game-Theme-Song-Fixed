import { FC } from 'react';
export interface ToggleProps {
    value: boolean;
    disabled?: boolean;
    onChange?(checked: boolean): void;
    navRef?: any;
}
/** @component React Components */
export declare const Toggle: FC<ToggleProps>;
