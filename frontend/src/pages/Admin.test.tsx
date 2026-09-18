import { beforeEach, describe, it } from 'vitest';

import { aFeatureFlagDTO } from '~/testkit/builders';
import { type AdminDriver, makeAdminDriver } from '~/pages/Admin.driver';

const FIRST_TOKEN = '2026-09-18T08:00:00.123456Z';
const SECOND_TOKEN = '2026-09-18T09:30:00.654321Z';
const ADMIN_TOKEN = 'the-pasted-admin-token';

describe('Admin page', () => {
    let driver: AdminDriver;

    beforeEach(() => {
        driver = makeAdminDriver();
    });

    it('saves an edited cta label with the token the flag was read at', async () => {
        driver.given.theServerListsFlags(aFeatureFlagDTO().withUpdatedAt(FIRST_TOKEN).build());
        driver.given.theSaveSucceedsWithToken(SECOND_TOKEN);
        await driver.when.created();
        await driver.type.adminToken(ADMIN_TOKEN);
        await driver.type.urgentCtaLabel('Protect me today');
        await driver.click.save();
        driver.assert.saveCarried({ ctaLabel: 'Protect me today', lockToken: FIRST_TOKEN, adminToken: ADMIN_TOKEN });
        await driver.assert.savedConfirmationIsShown();
    });

    it('shows an error instead of an empty console when the flags cannot be loaded', async () => {
        driver.given.theFlagListFails();
        await driver.when.created();
        await driver.assert.loadErrorIsShown();
    });

    it('tells the operator the flags did not load in their words and logs the server’s', async () => {
        driver.given.theFlagListFails();
        await driver.when.created();
        await driver.assert.loadFailureIsShownWithoutTheServersWords();
        driver.assert.loadFailureWasLogged();
    });

    it('keeps the admin token field and offers a retry when the flags cannot be loaded', async () => {
        driver.given.theFlagListFails();
        await driver.when.created();
        await driver.assert.loadErrorIsShown();
        driver.assert.adminTokenFieldIsShown();
    });

    it('recovers without a reload when the backend comes back', async () => {
        driver.given.theFlagListFails();
        await driver.when.created();
        await driver.assert.loadErrorIsShown();
        driver.given.theServerListsFlags(aFeatureFlagDTO().build());
        await driver.click.retry();
        await driver.assert.flagIsShown();
    });
});
