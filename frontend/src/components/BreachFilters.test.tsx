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

    it('sends no second request when the sort already in force is tapped again', async () => {
        await driver.when.created();
        await driver.assert.lastListQueryWas({});
        await driver.click.sort(SortOption.Newest);
        driver.assert.listRequestsSent(1);
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

describe('BreachFilters results line', () => {
    let driver: BreachFiltersDriver;

    beforeEach(() => {
        driver = makeBreachFiltersDriver();
    });

    it('says how much of the record is on screen, and offers to clear filters only once one is set', async () => {
        driver.given.theSummary(aBreachSummaryDTO().build());
        driver.given.theListHolds(1036);
        await driver.when.created();
        await driver.assert.resultsLineReads('Showing 20 of 1,036');
        driver.assert.clearFiltersIsNotOffered();
        await driver.click.dataClass('Passwords');
        await driver.assert.clearFiltersIsOffered();
        await driver.click.clearFilters();
        await driver.assert.lastListQueryWas({});
        driver.assert.clearFiltersIsNotOffered();
    });

    it('does not offer to clear filters for a sort alone', async () => {
        driver.given.theListHolds(1036);
        await driver.when.created();
        await driver.click.sort(SortOption.Name);
        await driver.assert.lastListQueryWas({ sort: 'name', order: 'asc' });
        driver.assert.clearFiltersIsNotOffered();
    });

    it('searches the record for what the visitor typed, and Clear filters empties the search too', async () => {
        driver.given.theListHolds(1036);
        await driver.when.created();
        await driver.type.intoSearch('adobe');
        await driver.assert.lastListQueryWas({ q: 'adobe' });
        await driver.assert.clearFiltersIsOffered();
        await driver.click.clearFilters();
        await driver.assert.lastListQueryWas({});
        driver.assert.searchIsEmpty();
    });

    it('re-queries for verified breaches only when the toggle is on, and for all when it is off again', async () => {
        await driver.when.created();
        await driver.click.verifiedOnly();
        await driver.assert.lastListQueryWas({ verifiedOnly: 'true' });
        await driver.click.verifiedOnly();
        await driver.assert.lastListQueryWas({});
    });
});
