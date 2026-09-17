import { beforeEach, describe, it } from 'vitest';

import { AppDriver, makeAppDriver } from '~/App.driver';

describe('App', () => {
    let driver: AppDriver;

    beforeEach(() => {
        driver = makeAppDriver();
    });

    it('shows the landing page at the root route', () => {
        driver.given.route('/');
        driver.when.created();
        driver.assert.landingIsShown();
    });
});
