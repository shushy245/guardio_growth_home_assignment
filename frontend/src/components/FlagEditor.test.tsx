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

    it('sends one save when the button is clicked again before the first one answers', async () => {
        driver.given.theFlag(aFeatureFlagDTO().withUpdatedAt(FIRST_TOKEN).build());
        driver.given.theSaveHangs(SECOND_TOKEN);
        await driver.when.created();
        await driver.click.save();
        await driver.click.save();
        await driver.when.theSaveResponds();
        driver.assert.saveTokensSent(FIRST_TOKEN);
    });

    it('keeps an edit typed while the save it overlaps is still in flight', async () => {
        driver.given.theFlag(aFeatureFlagDTO().withUpdatedAt(FIRST_TOKEN).build());
        driver.given.theSaveHangs(SECOND_TOKEN);
        await driver.when.created();
        await driver.click.save();
        await driver.type.urgentCtaLabel('Typed while the save was in flight');
        await driver.when.theSaveResponds();
        driver.assert.urgentCtaLabelIs('Typed while the save was in flight');
    });

    it('drops the saved confirmation as soon as the operator edits again', async () => {
        driver.given.theFlag(aFeatureFlagDTO().withUpdatedAt(FIRST_TOKEN).build());
        driver.given.theSaveSucceedsWithToken(SECOND_TOKEN);
        await driver.when.created();
        await driver.click.save();
        await driver.assert.savedConfirmationIsShown();
        await driver.type.urgentCtaLabel('Edited after the save');
        driver.assert.noSaveMessageIsShown();
    });

    it('tells the operator a save failed in their words and logs the server’s', async () => {
        driver.given.theFlag(aFeatureFlagDTO().withUpdatedAt(FIRST_TOKEN).build());
        driver.given.theSaveFails();
        await driver.when.created();
        await driver.click.save();
        await driver.assert.saveFailureIsShown();
        driver.assert.saveFailureWasLogged();
    });

    it('does not offer a save before the admin token is pasted, and says why', async () => {
        driver.given.theFlag(aFeatureFlagDTO().build());
        driver.given.theAdminToken('');
        await driver.when.created();
        await driver.type.urgentCtaLabel('Protect me today');
        driver.assert.saveIsNotOffered();
        await driver.assert.failureMessageIsShown('Paste the admin token');
        await driver.click.save();
        driver.assert.savesSent(0);
    });

    it('does not offer a save while the split leaves buckets unassigned', async () => {
        driver.given.theFlag(aFeatureFlagDTO().build());
        await driver.when.created();
        driver.assert.saveIsOffered();
        await driver.type.urgentWeight('40');
        driver.assert.saveIsNotOffered();
    });

    it('holds a weight typed above the whole split at the whole split', async () => {
        driver.given.theFlag(aFeatureFlagDTO().build());
        await driver.when.created();
        await driver.type.urgentWeight('999');
        driver.assert.urgentWeightIs(100);
    });
});
