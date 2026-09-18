import { beforeEach, describe, it } from 'vitest';

import { SortOption } from '~/components/BreachFilters.utils';
import { type BreachFiltersDriver, makeBreachFiltersDriver } from '~/components/BreachFilters.driver';

describe('BreachFilters', () => {
    let driver: BreachFiltersDriver;

    beforeEach(() => {
        driver = makeBreachFiltersDriver();
    });

    it('re-queries the record sorted by most accounts when that segment is chosen', async () => {
        await driver.when.created();
        await driver.assert.lastListQueryWas({});
        await driver.click.sort(SortOption.MostAccounts);
        await driver.assert.lastListQueryWas({ sort: 'pwnCount', order: 'desc' });
        driver.assert.sortIsSelected(SortOption.MostAccounts);
    });
});
