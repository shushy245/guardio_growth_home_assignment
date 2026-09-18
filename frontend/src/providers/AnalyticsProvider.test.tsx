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

describe('AnalyticsProvider before the visitor is known', () => {
    let driver: AnalyticsProviderDriver;

    beforeEach(() => {
        driver = makeAnalyticsProviderDriver();
    });

    it('holds the steps and posts them in order once the visitor arrives', async () => {
        driver.given.theVisitorIsSlowToArrive();
        await driver.when.created();
        await driver.click.trackScanStarted();
        await driver.assert.eventsPosted(0);
        await driver.when.theVisitorArrives();
        await driver.assert.postedEventNamesInOrder([FunnelEventName.LandingView, FunnelEventName.ScanStarted]);
    });

    it('keeps a step recorded as the visitor arrives behind the steps already waiting', async () => {
        // A page shown only once the session is ready mounts in the same commit that made it
        // ready, and runs its effect before the provider's — its step must still come after.
        driver.given.aStepShownOnceTheVisitorIsReady(FunnelEventName.ScanCompleted);
        await driver.when.created();
        await driver.assert.postedEventNamesInOrder([FunnelEventName.LandingView, FunnelEventName.ScanCompleted]);
    });

    it('drops the waiting steps with a log when the session fails, and never posts without a visitor', async () => {
        driver.given.theVisitorCannotBeCreated();
        await driver.when.created();
        await driver.assert.droppedEventsWereLogged(1);
        await driver.assert.eventsPosted(0);
    });
});

describe('AnalyticsProvider and the mount effect', () => {
    let driver: AnalyticsProviderDriver;

    beforeEach(() => {
        driver = makeAnalyticsProviderDriver();
    });

    it('posts one event although StrictMode runs the mount effect twice', async () => {
        driver.given.strictMode();
        await driver.when.created();
        await driver.assert.postedEventNamesInOrder([FunnelEventName.LandingView]);
        await driver.assert.eventsPosted(1);
    });

    it('posts the step again, under a new id, when it is shown again', async () => {
        // Revisiting the landing page is a second visit; the dedupe is per mount, never per name.
        await driver.when.created();
        await driver.assert.eventsPosted(1);
        await driver.click.showTheStepAgain();
        await driver.assert.postedEventNamesInOrder([FunnelEventName.LandingView, FunnelEventName.LandingView]);
        driver.assert.postedEventIdsAreDistinct();
    });
});
