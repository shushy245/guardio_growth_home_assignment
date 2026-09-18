import { beforeEach, describe, it } from 'vitest';

import { FunnelEventName } from '~/models/funnelEvent';
import { makeScanDriver, type ScanDriver } from '~/pages/Scan.driver';

describe('Scan', () => {
    let driver: ScanDriver;

    beforeEach(() => {
        driver = makeScanDriver();
    });

    it('holds the scanning moment until both the time has passed and the record has arrived', async () => {
        driver.given.theCatalogIsSlowToArrive();
        await driver.when.created();
        driver.assert.scanningIsShown();
        await driver.when.theMomentPasses();
        driver.assert.resultRouteIsNotShown();
        await driver.when.theCatalogArrives();
        driver.assert.resultRouteIsShown();
        driver.assert.stepsPosted(FunnelEventName.ScanCompleted, 1);
    });

    it('waits for the moment to pass when the record arrives first', async () => {
        driver.given.theCatalogIsSlowToArrive();
        await driver.when.created();
        await driver.when.theCatalogArrives();
        driver.assert.resultRouteIsNotShown();
        await driver.when.theMomentPasses();
        driver.assert.resultRouteIsShown();
        driver.assert.stepsPosted(FunnelEventName.ScanCompleted, 1);
    });

    it('shows the failure with a way to try again when the record cannot be reached, and goes nowhere', async () => {
        driver.given.theCatalogCannotBeReached();
        await driver.when.created();
        await driver.when.theMomentPasses();
        driver.assert.errorIsShown();
        driver.assert.resultRouteIsNotShown();
        driver.assert.stepsPosted(FunnelEventName.ScanCompleted, 0);
        await driver.click.retry();
        driver.assert.catalogRequested(2);
    });

    it('records nothing and goes nowhere for a visitor who leaves mid-scan', async () => {
        driver.given.theCatalogIsSlowToArrive();
        await driver.when.created();
        await driver.when.unmounted();
        driver.assert.nothingIsStillScheduled();
        await driver.when.theCatalogArrives();
        await driver.when.theMomentPasses();
        driver.assert.stepsPosted(FunnelEventName.ScanCompleted, 0);
        driver.assert.resultRouteIsNotShown();
    });
});
