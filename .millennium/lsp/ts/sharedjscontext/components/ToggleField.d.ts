import { FC } from 'react';
import { ItemProps } from './Item';
export interface ToggleFieldProps extends ItemProps {
    highlightOnFocus?: boolean;
    checked: boolean;
    disabled?: boolean;
    onChange?(checked: boolean): void;
}
/** @component React Components */
export declare const ToggleField: FC<ToggleFieldProps>;
