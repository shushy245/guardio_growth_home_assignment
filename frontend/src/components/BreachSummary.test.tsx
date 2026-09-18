import { beforeEach, describe, it } from 'vitest';

import { Tone } from '~/models/featureFlag';
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

describe('BreachSummary count-up', () => {
    let driver: BreachSummaryDriver;

    beforeEach(() => {
        driver = makeBreachSummaryDriver();
    });

    it('counts the exposed accounts up to the figure on the urgent variant', async () => {
        driver.given.theTone(Tone.Urgent);
        await driver.when.created();
        await driver.assert.tilesAreShown();
        await driver.when.framesPass(1);
        driver.assert.tileReadsLessThan(SummaryTile.AccountsExposed, '17.7B');
        await driver.when.framesPass(120);
        await driver.assert.tileReads(SummaryTile.AccountsExposed, '17.7B');
    });

    it('shows the figure at once on the urgent variant when the visitor prefers reduced motion', async () => {
        driver.given.theTone(Tone.Urgent);
        driver.given.theVisitorPrefersReducedMotion();
        await driver.when.created();
        await driver.assert.tileReads(SummaryTile.AccountsExposed, '17.7B');
        driver.assert.nothingIsStillScheduled();
    });

    it('never counts on the calm variant', async () => {
        driver.given.theTone(Tone.Calm);
        await driver.when.created();
        await driver.assert.tileReads(SummaryTile.AccountsExposed, '17.7B');
        driver.assert.nothingIsStillScheduled();
    });

    it('stops counting when the tiles leave the screen', async () => {
        driver.given.theTone(Tone.Urgent);
        await driver.when.created();
        await driver.assert.tilesAreShown();
        await driver.when.framesPass(1);
        await driver.when.unmounted();
        driver.assert.nothingIsStillScheduled();
    });
});
