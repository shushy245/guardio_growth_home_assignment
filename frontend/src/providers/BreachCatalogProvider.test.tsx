import { beforeEach, describe, it } from 'vitest';

import {
    type BreachCatalogProviderDriver,
    makeBreachCatalogProviderDriver,
} from '~/providers/BreachCatalogProvider.driver';

describe('BreachCatalogProvider', () => {
    let driver: BreachCatalogProviderDriver;

    beforeEach(() => {
        driver = makeBreachCatalogProviderDriver();
    });

    it('loads the record once however many parts of the screen read it', async () => {
        driver.given.consumers(3);
        await driver.when.created();
        await driver.assert.everyConsumerReadsTheCatalog();
        driver.assert.catalogFetched(1);
    });

    it('abandons a page still in flight when the funnel is left', async () => {
        driver.given.theFirstPageIsSlowToArrive();
        await driver.when.created();
        driver.assert.listRequestWasNotAborted(0);
        await driver.when.unmounted();
        driver.assert.listRequestWasAborted(0);
    });

    it('abandons the page in flight when a filter changes, so an older answer never lands over a newer one', async () => {
        driver.given.theFirstPageIsSlowToArrive();
        driver.given.theFilteredRecordHolds('McKesson');
        await driver.when.created();
        await driver.click.filterByDataClass();
        driver.assert.listRequestWasAborted(0);
        await driver.when.theFirstPageArrives();
        await driver.assert.itemsAre('McKesson');
        await driver.assert.listRequestsWere({}, { dataClass: 'Passwords' });
    });

    it('appends the next page under the first, and a filter change starts again from page one', async () => {
        driver.given.theFirstPageHolds('Adobe', 'Canva');
        driver.given.theSecondPageHolds('Dropbox');
        driver.given.theFilteredRecordHolds('McKesson');
        await driver.when.created();
        await driver.assert.itemsAre('Adobe', 'Canva');
        await driver.click.loadMore();
        await driver.assert.itemsAre('Adobe', 'Canva', 'Dropbox');
        await driver.click.filterByDataClass();
        await driver.assert.itemsAre('McKesson');
        await driver.assert.listRequestsWere({}, { page: '2' }, { dataClass: 'Passwords' });
    });
});
