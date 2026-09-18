import { beforeEach, describe, it } from 'vitest';

import { makeSearchFieldDriver, type SearchFieldDriver } from '~/components/SearchField.driver';

describe('SearchField', () => {
    let driver: SearchFieldDriver;

    beforeEach(() => {
        driver = makeSearchFieldDriver();
    });

    it('searches once for a word typed quickly, after the visitor pauses', async () => {
        await driver.when.created();
        await driver.type.intoSearch('adobe');
        driver.assert.fieldReads('adobe');
        driver.assert.searchedFor();
        await driver.when.thePausePasses();
        driver.assert.searchedFor('adobe');
    });

    it('clears the search when the field is emptied', async () => {
        driver.given.theCurrentQuery('adobe');
        await driver.when.created();
        driver.assert.fieldReads('adobe');
        await driver.clear.search();
        await driver.when.thePausePasses();
        driver.assert.searchedFor(undefined);
    });

    it('keeps what the visitor typed after a pause while the rest of the word is still coming', async () => {
        await driver.when.created();
        await driver.type.intoSearch('ado');
        await driver.when.thePausePasses();
        await driver.type.intoSearch('be');
        driver.assert.fieldReads('adobe');
        await driver.when.thePausePasses();
        driver.assert.searchedFor('ado', 'adobe');
    });

    it('empties the field when the filters are cleared elsewhere on the page', async () => {
        driver.given.theCurrentQuery('adobe');
        await driver.when.created();
        await driver.clear.fromOutside();
        driver.assert.fieldReads('');
        await driver.when.thePausePasses();
        driver.assert.searchedFor();
    });
});
