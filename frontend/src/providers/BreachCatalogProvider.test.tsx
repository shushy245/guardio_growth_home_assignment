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
});
