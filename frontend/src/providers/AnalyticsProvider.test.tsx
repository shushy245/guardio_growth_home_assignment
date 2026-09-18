import { beforeEach, describe, it } from 'vitest';

import { aVisitorDTO } from '~/testkit/builders';
import { FunnelEventName } from '~/models/funnelEvent';
import { type AnalyticsProviderDriver, makeAnalyticsProviderDriver } from '~/providers/AnalyticsProvider.driver';

describe('AnalyticsProvider', () => {
    let driver: AnalyticsProviderDriver;

    beforeEach(() => {
        driver = makeAnalyticsProviderDriver();
    });

    it('posts a step once with its id, the visitor, the name and the time it happened', async () => {
        driver.given.theServerCreates(aVisitorDTO().withId('vis_known').build());
        await driver.when.created();
        await driver.assert.postedEventIsWellFormed({ name: FunnelEventName.LandingView, visitorId: 'vis_known' });
    });

    it('logs a post the server rejected and carries on', async () => {
        driver.given.theServerRejectsEvents();
        await driver.when.created();
        await driver.assert.failureWasLogged();
    });
});
