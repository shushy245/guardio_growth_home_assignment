import { beforeEach, describe, it } from 'vitest';

import { FunnelEventName } from '~/models/funnelEvent';
import { type LandingDriver, makeLandingDriver } from '~/pages/Landing.driver';

describe('Landing', () => {
    let driver: LandingDriver;

    beforeEach(() => {
        driver = makeLandingDriver();
    });

    it('offers the scan and records the visit once on arrival', async () => {
        await driver.when.created();
        driver.assert.scanButtonIsShown();
        await driver.assert.stepsPosted(FunnelEventName.LandingView, 1);
    });
});
