// Placeholder until S6 builds the sign-up screen against the D1 design. It exists so the result
// screen's CTA lands on a page rather than on a route the table does not know, which renders a
// blank document (S5 review, F-2). The S1 landing route stood in the same way until S5.
import type { ReactElement } from 'react';

import { MainColumn } from '~/ui/box';
import { Wordmark } from '~/components/Wordmark';
import { SignupTestIds } from '~/pages/Signup.utils';

import styles from '~/pages/Signup.module.scss';

export const Signup = (): ReactElement => (
    <MainColumn className={styles.page} data-testid={SignupTestIds.Page}>
        <Wordmark />
        <h1 className={styles.headline}>{`Sign up`}</h1>
    </MainColumn>
);
