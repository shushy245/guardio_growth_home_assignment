import { beforeEach, describe, it } from 'vitest';

import { LOADING, type LoadedStateDriver, makeLoadedStateDriver } from '~/hooks/useLoadedState.driver';

const A_RECORD = 'the record';

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

    it('applies nothing when the answer lands after the screen has gone', async () => {
        driver.given.theLoadAnswersWith(A_RECORD);
        await driver.when.created();
        await driver.when.unmounted();
        await driver.when.theLoadAnswers();
        driver.assert.nothingWasShownAfterUnmount();
    });
});
