import { ReactElement } from 'react';

import { LandingTestIds } from '~/pages/Landing.utils';
import { FullColumn } from '~/ui/box';

// Placeholder until S5 builds the real landing screen against the D1 design.
export const Landing = (): ReactElement => (
    <FullColumn data-testid={LandingTestIds.Page}>
        <h1>Breach Scan</h1>
    </FullColumn>
);
