import { ReactElement } from 'react';

import { BoxProps, joinClassNames } from '~/ui/box.utils';

import styles from '~/ui/primitives.module.scss';

export const Box = ({ children, className, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(className)} data-testid={testId}>
        {children}
    </div>
);

export const Row = ({ children, className, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.row, className)} data-testid={testId}>
        {children}
    </div>
);

export const Column = ({ children, className, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.column, className)} data-testid={testId}>
        {children}
    </div>
);

export const FullRow = ({ children, className, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.fullRow, className)} data-testid={testId}>
        {children}
    </div>
);

export const FullColumn = ({ children, className, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.fullColumn, className)} data-testid={testId}>
        {children}
    </div>
);

// The page's main landmark, and a Column like any other. A page with no landmark offers a
// screen-reader user no way to skip to its content; rendering it as an element rather than a
// prop on Column keeps the layout vocabulary a closed set.
export const MainColumn = ({ children, className, 'data-testid': testId }: BoxProps): ReactElement => (
    <main className={joinClassNames(styles.column, className)} data-testid={testId}>
        {children}
    </main>
);

export const FullBox = ({ children, className, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.fullBox, className)} data-testid={testId}>
        {children}
    </div>
);
