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

    it('asks for nothing until the visitor has actually paused', async () => {
        await driver.when.created();
        await driver.type.intoSearch('adobe');
        await driver.when.almostThePausePasses();
        driver.assert.searchedFor();
        await driver.when.thePausePasses();
        driver.assert.searchedFor('adobe');
    });

    it('keeps what the visitor typed when the page answers the earlier search late', async () => {
        // The echo guard (BF80): the page answers with the query the field itself asked for,
        // and by then the visitor has typed more. Adopting it would rewrite their box.
        driver.given.thePageAnswersTheSearchLate();
        await driver.when.created();
        await driver.type.intoSearch('ado');
        await driver.when.thePausePasses();
        await driver.type.intoSearch('be');
        await driver.when.thePageAnswers();
        driver.assert.fieldReads('adobe');
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
