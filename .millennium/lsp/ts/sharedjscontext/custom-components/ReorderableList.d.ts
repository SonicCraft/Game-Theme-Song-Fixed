import { JSXElementConstructor, ReactElement, ReactNode } from 'react';
import { FieldProps } from '../components';
/**
 * A ReorderableList entry of type <T>.
 * @param label The name of this entry in the list.
 * @param data Optional data to connect to this entry.
 * @param position The position of this entry in the list.
 */
export type ReorderableEntry<T> = {
    label: ReactNode;
    data?: T;
    position: number;
};
/**
 * Properties for a ReorderableList component of type <T>.
 *
 * @param animate If the list should animate. @default true
 */
export type ReorderableListProps<T> = {
    entries: ReorderableEntry<T>[];
    onSave: (entries: ReorderableEntry<T>[]) => void;
    interactables?: JSXElementConstructor<{
        entry: ReorderableEntry<T>;
    }>;
    fieldProps?: FieldProps;
    animate?: boolean;
};
/**
 * A component for creating reorderable lists.
 *
 * See an example implementation {@linkplain https://github.com/Tormak9970/Component-Testing-Plugin/blob/main/src/testing-window/ReorderableListTest.tsx here}.
 */
export declare function ReorderableList<T>(props: ReorderableListProps<T>): import("react/jsx-runtime").JSX.Element;
/**
 * Properties for a ReorderableItem component of type <T>
 */
export type ReorderableListEntryProps<T> = {
    fieldProps?: FieldProps;
    listData: ReorderableEntry<T>[];
    entryData: ReorderableEntry<T>;
    reorderEntryFunc: CallableFunction;
    reorderEnabled: boolean;
    animate: boolean;
    children: ReactElement | null;
};
