import { beforeEach, describe, it } from 'vitest';

import { makeAppDriver } from '~/App.driver';

describe('App', () => {
    let driver: ReturnType<typeof makeAppDriver>;

    beforeEach(() => {
        driver = makeAppDriver();
    });

    it('shows the landing page at the root route', () => {
        driver.given.route('/');
        driver.when.created();
        driver.assert.landingIsShown();
    });
});
