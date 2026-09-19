import { beforeEach, describe, it } from 'vitest';

import { FunnelEventName } from '~/models/funnelEvent';
import { AppDriver, makeAppDriver } from '~/App.driver';

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
        await driver.assert.stepsPosted(FunnelEventName.LandingView, 0);
    });

    it('shows the sign-up page the result screen hands the visitor on to', async () => {
        driver.given.route('/signup');
        await driver.when.created();
        driver.assert.signupIsShown();
    });

    it('fetches the flag list once on the admin page', async () => {
        driver.given.route('/admin');
        await driver.when.created();
        driver.assert.flagListsFetched(1);
    });
});
