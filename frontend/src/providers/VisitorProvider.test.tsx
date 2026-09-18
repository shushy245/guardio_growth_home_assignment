import { beforeEach, describe, it } from 'vitest';

import { aFeatureFlagDTO, aVisitorDTO } from '~/testkit/builders';
import { makeVisitorProviderDriver, type VisitorProviderDriver } from '~/providers/VisitorProvider.driver';

describe('VisitorProvider', () => {
    let driver: VisitorProviderDriver;

    beforeEach(() => {
        driver = makeVisitorProviderDriver();
    });

    it('creates a visitor when none is stored and exposes their variant', async () => {
        driver.given.theServerCreates(
            aVisitorDTO().withId('vis_new').assignedTo('result_screen_tone', 'urgent').build(),
        );
        driver.given.theServerListsFlags(aFeatureFlagDTO().build());
        await driver.when.created();
        await driver.assert.headlineIsShown("You're exposed!");
        driver.assert.visitorsCreated(1);
        driver.assert.storedVisitorIdIs('vis_new');
    });
});

describe('VisitorProvider with a stored visitor', () => {
    let driver: VisitorProviderDriver;

    beforeEach(() => {
        driver = makeVisitorProviderDriver();
    });

    it('fetches the stored visitor and does not create a new one', async () => {
        driver.given.storedVisitorId('vis_known');
        driver.given.theServerKnowsVisitor(
            aVisitorDTO().withId('vis_known').assignedTo('result_screen_tone', 'calm').build(),
        );
        driver.given.theServerListsFlags(aFeatureFlagDTO().build());
        await driver.when.created();
        await driver.assert.headlineIsShown('Known breaches');
        driver.assert.visitorWasFetched('vis_known');
        driver.assert.visitorsCreated(0);
    });

    it('starts a new visitor when the server no longer knows the stored one', async () => {
        // The database was reset while the browser kept its mirror: not an error, a fresh start.
        driver.given.storedVisitorId('vis_stale');
        driver.given.theServerHasForgottenVisitor('vis_stale');
        driver.given.theServerCreates(
            aVisitorDTO().withId('vis_fresh').assignedTo('result_screen_tone', 'calm').build(),
        );
        await driver.when.created();
        await driver.assert.headlineIsShown('Known breaches');
        driver.assert.visitorsCreated(1);
        driver.assert.storedVisitorIdIs('vis_fresh');
    });
});

describe('VisitorProvider when creation fails', () => {
    let driver: VisitorProviderDriver;

    beforeEach(() => {
        driver = makeVisitorProviderDriver();
    });

    it('surfaces an error state and never a default variant', async () => {
        driver.given.visitorCreationFails();
        await driver.when.created();
        await driver.assert.sessionFailedWith('internal error');
        driver.assert.noHeadlineIsShown();
    });
});

describe('VisitorProvider under StrictMode', () => {
    let driver: VisitorProviderDriver;

    beforeEach(() => {
        driver = makeVisitorProviderDriver();
    });

    it('creates exactly one visitor although the effect runs twice', async () => {
        driver.given.strictMode();
        driver.given.theServerCreates(aVisitorDTO().withId('vis_once').build());
        await driver.when.created();
        await driver.assert.headlineIsShown("You're exposed!");
        driver.assert.visitorsCreated(1);
    });
});
