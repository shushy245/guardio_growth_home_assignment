import { beforeEach, describe, it } from 'vitest';

import { aBreachSummaryDTO } from '~/testkit/builders';
import { SummaryTile } from '~/components/BreachSummary.utils';
import { type BreachSummaryDriver, makeBreachSummaryDriver } from '~/components/BreachSummary.driver';

describe('BreachSummary', () => {
    let driver: BreachSummaryDriver;

    beforeEach(() => {
        driver = makeBreachSummaryDriver();
    });

    it('answers "why should I care" with four tiles from the record', async () => {
        driver.given.theSummary(aBreachSummaryDTO().build());
        await driver.when.created();
        await driver.assert.tileReads(SummaryTile.RecentBreaches, '102');
        await driver.assert.tileReads(SummaryTile.AccountsExposed, '17.7B');
        await driver.assert.tileReads(SummaryTile.PasswordsLeaked, '65%');
        await driver.assert.tileReads(SummaryTile.LargestBreach, 'Adobe');
        await driver.assert.tileSupportReads(SummaryTile.LargestBreach, '152.4M accounts');
    });

    it('holds the space with skeleton tiles until the summary arrives', async () => {
        driver.given.theSummaryIsSlowToArrive();
        await driver.when.created();
        driver.assert.skeletonTilesAreShown();
        await driver.when.theSummaryArrives();
        await driver.assert.tilesAreShown();
    });
});
