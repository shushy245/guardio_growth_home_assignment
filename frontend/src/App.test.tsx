import { beforeEach, describe, it } from 'vitest';

import { FunnelEventName } from '~/models/funnelEvent';
import { A_SIGNUP_STATE, AppDriver, makeAppDriver } from '~/App.driver';

describe('App', () => {
    let driver: AppDriver;

    beforeEach(() => {
        driver = makeAppDriver();
    });

    it('shows the landing page at the root route', async () => {
        driver.given.route('/');
        await driver.when.created();
        driver.assert.landingIsShown();
    });

    it('enrols a visitor in the experiment on the funnel', async () => {
        driver.given.route('/');
        await driver.when.created();
        driver.assert.visitorsCreated(1);
    });

    it('does not enrol the operator in the experiment when they open the admin page', async () => {
        driver.given.route('/admin');
        await driver.when.created();
        driver.assert.adminIsShown();
        driver.assert.visitorsCreated(0);
    });

    it('records the visit once when the funnel is opened', async () => {
        driver.given.route('/');
        await driver.when.created();
        await driver.assert.stepsPosted(FunnelEventName.LandingView, 1);
    });

    it('records no step when the admin page is opened', async () => {
        driver.given.route('/admin');
        await driver.when.created();
        driver.assert.adminIsShown();
        driver.assert.noStepPosted(FunnelEventName.LandingView);
    });

    it('shows the sign-up page the result screen hands the visitor on to', async () => {
        driver.given.route('/signup');
        await driver.when.created();
        driver.assert.signupIsShown();
    });

    it('shows the confirmation page a sign-up hands the visitor on to', async () => {
        driver.given.route('/protected', A_SIGNUP_STATE);
        await driver.when.created();
        driver.assert.protectedIsShown();
    });

    it('shows a way back instead of a blank document at a URL that matches nothing', async () => {
        // Without a catch-all every unmatched URL renders an empty <Routes>: a white page with
        // no heading, no error and nothing to click (BF69).
        driver.given.route('/a-url-that-matches-nothing');
        await driver.when.created();
        driver.assert.notFoundIsShown();
    });

    it('records no step and enrols nobody at a URL that matches nothing', async () => {
        driver.given.route('/a-url-that-matches-nothing');
        await driver.when.created();
        driver.assert.visitorsCreated(0);
        driver.assert.noStepPosted(FunnelEventName.LandingView);
    });

    it('fetches the flag list once on the admin page', async () => {
        driver.given.route('/admin');
        await driver.when.created();
        driver.assert.flagListsFetched(1);
    });
});
