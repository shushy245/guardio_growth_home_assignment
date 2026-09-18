import { beforeEach, describe, it } from 'vitest';

import { aBreachSummaryDTO } from '~/testkit/builders';
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

    it('narrows the record to a data class when its chip is tapped, and widens it again on the second tap', async () => {
        driver.given.theSummary(aBreachSummaryDTO().build());
        await driver.when.created();
        await driver.click.dataClass('Passwords');
        await driver.assert.lastListQueryWas({ dataClass: 'Passwords' });
        driver.assert.dataClassIsSelected('Passwords');
        await driver.click.dataClass('Passwords');
        await driver.assert.lastListQueryWas({});
        driver.assert.noDataClassIsSelected();
    });

    it('keeps the sort when a data class is chosen', async () => {
        driver.given.theSummary(aBreachSummaryDTO().build());
        await driver.when.created();
        await driver.click.sort(SortOption.Name);
        await driver.click.dataClass('Passwords');
        await driver.assert.lastListQueryWas({ sort: 'name', order: 'asc', dataClass: 'Passwords' });
    });
});
