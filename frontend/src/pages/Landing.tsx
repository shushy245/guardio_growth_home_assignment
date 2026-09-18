import { ReactElement } from 'react';

import { MainColumn } from '~/ui/box';
import { LandingTestIds } from '~/pages/Landing.utils';

import styles from '~/pages/Landing.module.scss';

// Placeholder until S5 builds the real landing screen against the D1 design.
export const Landing = (): ReactElement => (
    <MainColumn className={styles.page} data-testid={LandingTestIds.Page}>
        <h1>{`Breach Scan`}</h1>
    </MainColumn>
);
