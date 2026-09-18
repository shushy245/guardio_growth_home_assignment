import { ReactElement } from 'react';

import { MainColumn } from '~/ui/box';
import { LandingTestIds } from '~/pages/Landing.utils';

// Placeholder until S5 builds the real landing screen against the D1 design.
export const Landing = (): ReactElement => (
    <MainColumn data-testid={LandingTestIds.Page}>
        <h1>{`Breach Scan`}</h1>
    </MainColumn>
);
