import { beforeEach, describe, it } from 'vitest';

import { aFeatureFlagDTO } from '~/testkit/builders';
import { type FlagEditorDriver, makeFlagEditorDriver } from '~/components/FlagEditor.driver';

const FIRST_TOKEN = '2026-09-18T08:00:00.123456Z';
const SECOND_TOKEN = '2026-09-18T09:30:00.654321Z';

describe('FlagEditor', () => {
    let driver: FlagEditorDriver;

    beforeEach(() => {
        driver = makeFlagEditorDriver();
    });

    it('keeps the edited value and asks for a reload when the flag changed underneath', async () => {
        driver.given.theFlag(aFeatureFlagDTO().withUpdatedAt(FIRST_TOKEN).build());
        driver.given.theSaveConflicts();
        await driver.when.created();
        await driver.type.urgentCtaLabel('Protect me today');
        await driver.click.save();
        await driver.assert.conflictMessageIsShown();
        driver.assert.urgentCtaLabelIs('Protect me today');
    });

    it('carries the token the previous save returned into the next one', async () => {
        driver.given.theFlag(aFeatureFlagDTO().withUpdatedAt(FIRST_TOKEN).build());
        driver.given.theSaveSucceedsWithToken(SECOND_TOKEN);
        await driver.when.created();
        await driver.type.urgentCtaLabel('First edit');
        await driver.click.save();
        await driver.assert.savedConfirmationIsShown();
        await driver.type.urgentCtaLabel('Second edit');
        await driver.click.save();
        driver.assert.saveTokensSent(FIRST_TOKEN, SECOND_TOKEN);
    });

    it('saves the flag as stopped after the running checkbox is cleared', async () => {
        driver.given.theFlag(aFeatureFlagDTO().build());
        driver.given.theSaveSucceedsWithToken(SECOND_TOKEN);
        await driver.when.created();
        await driver.click.enabled();
        await driver.click.save();
        driver.assert.saveCarried({ isEnabled: false });
    });

    it('refuses to send a save before the admin token is pasted', async () => {
        driver.given.theFlag(aFeatureFlagDTO().build());
        driver.given.theAdminToken('');
        await driver.when.created();
        await driver.type.urgentCtaLabel('Protect me today');
        await driver.click.save();
        await driver.assert.failureMessageIsShown('Paste the admin token');
        driver.assert.savesSent(0);
    });
});
