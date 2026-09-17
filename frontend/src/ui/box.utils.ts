import { CSSProperties, ReactNode } from 'react';

export enum Primitive {
    Box = 'box',
    Row = 'row',
    Column = 'column',
    FullRow = 'fullRow',
    FullColumn = 'fullColumn',
    FullBox = 'fullBox',
}

export type BoxProps = {
    children: ReactNode;
    className?: string | undefined;
    style?: CSSProperties | undefined;
    'data-testid'?: string | undefined;
};

export const joinClassNames = (...names: (string | undefined)[]): string =>
    names.filter((name): name is string => name !== undefined && name !== '').join(' ');
