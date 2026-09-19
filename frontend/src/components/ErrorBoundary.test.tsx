import { beforeEach, describe, it } from 'vitest';

import { type ErrorBoundaryDriver, makeErrorBoundaryDriver } from '~/components/ErrorBoundary.driver';

describe('ErrorBoundary', () => {
    let driver: ErrorBoundaryDriver;

    beforeEach(() => {
        driver = makeErrorBoundaryDriver();
    });

    it('renders what it wraps while nothing throws', async () => {
        await driver.when.created();
        driver.assert.theChildIsShown();
        driver.assert.nothingWasReloaded();
    });

    it('shows a failure with a way out instead of the blank document a throw leaves', async () => {
        driver.given.aChildThatThrowsWhileRendering();
        await driver.when.created();
        driver.assert.theFailureIsShown();
    });

    it('logs what was thrown and does not put it on the screen', async () => {
        driver.given.aChildThatThrowsWhileRendering();
        await driver.when.created();
        driver.assert.theFailureWasLogged();
    });

    it('reloads the page when the visitor asks to try again', async () => {
        // The tree that threw is the one on screen; React cannot re-render past it, so the only
        // honest offer is a fresh document.
        driver.given.aChildThatThrowsWhileRendering();
        await driver.when.created();
        await driver.click.retry();
        driver.assert.thePageWasReloaded();
    });
});
