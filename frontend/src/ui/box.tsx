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

export const FullBox = ({ children, className, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.fullBox, className)} data-testid={testId}>
        {children}
    </div>
);
