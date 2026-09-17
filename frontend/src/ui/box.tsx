import { ReactElement } from 'react';

import { BoxProps, joinClassNames } from '~/ui/box.utils';
import styles from '~/ui/primitives.module.scss';

export const Box = ({ children, className, style, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(className)} style={style} data-testid={testId}>
        {children}
    </div>
);

export const Row = ({ children, className, style, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.row, className)} style={style} data-testid={testId}>
        {children}
    </div>
);

export const Column = ({ children, className, style, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.column, className)} style={style} data-testid={testId}>
        {children}
    </div>
);

export const FullRow = ({ children, className, style, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.fullRow, className)} style={style} data-testid={testId}>
        {children}
    </div>
);

export const FullColumn = ({ children, className, style, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.fullColumn, className)} style={style} data-testid={testId}>
        {children}
    </div>
);

export const FullBox = ({ children, className, style, 'data-testid': testId }: BoxProps): ReactElement => (
    <div className={joinClassNames(styles.fullBox, className)} style={style} data-testid={testId}>
        {children}
    </div>
);
