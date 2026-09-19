import { beforeEach, describe, it } from 'vitest';

import { CountMode } from '~/hooks/useCountUp';
import { type CountUpDriver, makeCountUpDriver } from '~/hooks/useCountUp.driver';

const FIGURE = 17_700_000_000;
const NO_FIGURE_YET = 0;

describe('useCountUp', () => {
    let driver: CountUpDriver;

    beforeEach(() => {
        driver = makeCountUpDriver();
    });

    it('shows a figure that arrives later on the very commit it arrives, when nothing is counting', async () => {
        // The calm tone's tile: it renders at zero while the summary loads, and the figure lands
        // in a later render. Reconciling it in an effect painted "Accounts exposed 0" first.
        await driver.when.created({ target: NO_FIGURE_YET, mode: CountMode.Still });
        await driver.when.theFigureArrives(FIGURE);
        driver.assert.everyValueShownSinceWas(FIGURE);
    });

    it('shows a figure at once under reduced motion, however late it arrives', async () => {
        driver.given.theVisitorPrefersReducedMotion();
        await driver.when.created({ target: NO_FIGURE_YET, mode: CountMode.CountUp });
        await driver.when.theFigureArrives(FIGURE);
        driver.assert.everyValueShownSinceWas(FIGURE);
    });

    it('counts up to a figure that arrives later, and settles on it', async () => {
        await driver.when.created({ target: NO_FIGURE_YET, mode: CountMode.CountUp });
        await driver.when.theFigureArrives(FIGURE);
        await driver.when.framesPass(1);
        driver.assert.valueShownIsBelow(FIGURE);
        await driver.when.framesPass(120);
        driver.assert.valueShownIs(FIGURE);
    });
});
