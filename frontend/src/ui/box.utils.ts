import { ReactNode } from 'react';

export type BoxProps = {
    children: ReactNode;
    className?: string | undefined;
    'data-testid'?: string | undefined;
};

export const joinClassNames = (...names: (string | undefined)[]): string =>
    names.filter((name): name is string => name !== undefined && name !== '').join(' ');
