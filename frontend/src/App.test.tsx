import { beforeEach, describe, it } from 'vitest';

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

    it('fetches the flag list once on the admin page', async () => {
        driver.given.route('/admin');
        await driver.when.created();
        driver.assert.flagListsFetched(1);
    });
});
