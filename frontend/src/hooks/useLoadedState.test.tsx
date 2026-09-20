import { beforeEach, describe, it } from 'vitest';

import { LOADING, type LoadedStateDriver, makeLoadedStateDriver } from '~/hooks/useLoadedState.driver';

const A_RECORD = 'the record';
const AN_OLDER_RECORD = 'the record as it was before the reload';

describe('useLoadedState', () => {
    let driver: LoadedStateDriver;

    beforeEach(() => {
        driver = makeLoadedStateDriver();
    });

    it('asks for its data once although React mounts, unmounts and mounts it again', async () => {
        driver.given.theLoadAnswersWith(A_RECORD);
        await driver.when.created();
        driver.assert.wasAsked(1);
        driver.assert.isShowing(LOADING);
        await driver.when.theLoadAnswers();
        driver.assert.isShowing(A_RECORD);
    });

    it('asks again when it is reloaded', async () => {
        driver.given.theLoadAnswersWith(A_RECORD);
        await driver.when.created();
        await driver.when.theLoadAnswers();
        await driver.when.reloaded();
        driver.assert.wasAsked(2);
        driver.assert.isShowing(LOADING);
    });

    it('ignores the answer to a load that a reload has already replaced', async () => {
        // The guard's real job. Asserting that nothing renders after unmount measures React,
        // not the hook: React does not render an unmounted component whatever the hook does.
        // What only the guard prevents is this — the admin page's list hangs, the operator
        // clicks Retry, the retry answers, and then the first request answers with the flags
        // as they were, under a lock token that has since moved on.
        driver.given.theLoadAnswersWith(A_RECORD);
        await driver.when.created();
        await driver.when.reloaded();
        await driver.when.theLoadAnswers();
        driver.assert.isShowing(A_RECORD);
        await driver.when.theSupersededLoadAnswers(AN_OLDER_RECORD);
        driver.assert.isShowing(A_RECORD);
    });
});
