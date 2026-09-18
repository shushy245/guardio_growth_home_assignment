import { beforeEach, describe, it } from 'vitest';

import { type BreachListDriver, makeBreachListDriver } from '~/components/BreachList.driver';

describe('BreachList', () => {
    let driver: BreachListDriver;

    beforeEach(() => {
        driver = makeBreachListDriver();
    });

    it('adds the next page under the rows already shown when Load more is tapped', async () => {
        driver.given.theFirstPageHolds('Adobe', 'Canva');
        driver.given.theSecondPageIsSlowToArrive('Dropbox');
        await driver.when.created();
        await driver.assert.rowsAre('Adobe', 'Canva');
        await driver.assert.loadMoreIsOffered();
        await driver.click.loadMore();
        driver.assert.loadMoreIsBusy();
        await driver.assert.rowsAre('Adobe', 'Canva');
        await driver.when.thePageArrives();
        await driver.assert.rowsAre('Adobe', 'Canva', 'Dropbox');
    });

    it('offers no Load more once the whole record is on screen', async () => {
        await driver.when.created();
        await driver.assert.rowsAre('Adobe');
        driver.assert.loadMoreIsNotOffered();
    });

    it('shows the failure with a retry when the record cannot be loaded, never an empty list', async () => {
        driver.given.theListCannotBeLoaded();
        await driver.when.created();
        await driver.assert.errorIsShown();
        driver.given.theFirstPageHolds('Adobe');
        await driver.click.retry();
        await driver.assert.rowsAre('Adobe');
        driver.assert.errorIsNotShown();
    });

    it('holds the space with skeleton rows until the first page arrives', async () => {
        driver.given.theFirstPageIsSlowToArrive();
        await driver.when.created();
        driver.assert.skeletonRowsAreShown();
        await driver.when.thePageArrives();
        await driver.assert.rowsAre('Adobe');
    });

    it('says nothing matched, with a way to clear the filters, when a filter finds no breach', async () => {
        driver.given.theFilteredRecordIsEmpty();
        await driver.when.created();
        await driver.assert.rowsAre('Adobe');
        await driver.click.dataClass('Passwords');
        await driver.assert.emptyFilterStateIsShown();
        await driver.click.clearFilters();
        await driver.assert.rowsAre('Adobe');
    });
});
