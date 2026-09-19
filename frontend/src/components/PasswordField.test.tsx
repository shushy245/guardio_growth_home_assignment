import { beforeEach, describe, it } from 'vitest';

import { makePasswordFieldDriver, type PasswordFieldDriver } from '~/components/PasswordField.driver';

// SHA-1("password") starts 5BAA6; SHA-1("password1") starts E38AD. The suffixes never leave.
const LEAKED_PASSWORD = 'password';
const LEAKED_PREFIX = '5BAA6';
const ANOTHER_PASSWORD = 'password1';
const ANOTHER_PREFIX = 'E38AD';
const LEAK_COUNT = 3120000;

describe('PasswordField', () => {
    let driver: PasswordFieldDriver;

    beforeEach(() => {
        driver = makePasswordFieldDriver();
    });

    it('warns about a password whose hash suffix appears in the range, naming how often', async () => {
        await driver.given.theRangeSays({ password: LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.when.created();
        await driver.type.password(LEAKED_PASSWORD);
        await driver.when.thePausePasses();
        driver.assert.leakedWarningIsShown(LEAK_COUNT);
        driver.assert.fieldIsEditable();
    });

    it('is named by its label alone while the leak warning describes it', async () => {
        await driver.given.theRangeSays({ password: LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.when.created();
        driver.assert.fieldIsNamedByItsLabelAlone();
        await driver.type.password(LEAKED_PASSWORD);
        await driver.when.thePausePasses();
        driver.assert.fieldIsNamedByItsLabelAlone();
        driver.assert.leakWarningDescribesTheField(LEAK_COUNT);
    });

    it('shows no warning for a password the range does not list', async () => {
        await driver.given.theRangeIsCleanFor(ANOTHER_PASSWORD);
        await driver.when.created();
        await driver.type.password(ANOTHER_PASSWORD);
        await driver.when.thePausePasses();
        driver.assert.noWarningIsShown();
    });

    it('asks for one range per typing pause, never one per keystroke, and only the five-character prefix', async () => {
        await driver.given.theRangeSays({ password: LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.when.created();
        await driver.type.password(LEAKED_PASSWORD);
        driver.assert.checkingIsShown();
        driver.assert.rangesRequested();
        await driver.when.thePausePasses();
        driver.assert.rangesRequested(LEAKED_PREFIX);
    });

    it('asks for nothing until the visitor has actually paused', async () => {
        await driver.given.theRangeSays({ password: LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.when.created();
        await driver.type.password(LEAKED_PASSWORD);
        await driver.when.almostThePausePasses();
        driver.assert.rangesRequested();
        await driver.when.thePausePasses();
        driver.assert.rangesRequested(LEAKED_PREFIX);
    });

    it('says nothing about a password the visitor has since deleted', async () => {
        // The answer to a check nobody is waiting for any more. Aborting the request does not
        // cover this on its own — an answer already on the wire still arrives — so only the "is
        // this still the current password" guard keeps it off the screen (BF83).
        await driver.given.theRangeIsSlowToSay({ password: LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.when.created();
        await driver.type.password(LEAKED_PASSWORD);
        await driver.when.thePausePasses();
        await driver.clear.password();
        await driver.when.theSlowRangeArrives();
        driver.assert.noWarningIsShown();
        driver.assert.noUncheckedNoteIsShown();
    });

    it('abandons the range it asked for when the visitor types on', async () => {
        // The request itself, not only its answer: a superseded check that is never aborted
        // leaves the browser holding a request whose answer nobody may use (BF83).
        await driver.given.theRangeIsSlowToSay({ password: LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.given.theRangeIsCleanFor(ANOTHER_PASSWORD);
        await driver.when.created();
        await driver.type.password(LEAKED_PASSWORD);
        await driver.when.thePausePasses();
        driver.assert.rangesAbandoned();
        await driver.type.password('1');
        await driver.when.thePausePasses();
        driver.assert.rangesAbandoned(LEAKED_PREFIX);
    });

    it('ignores a stale range that arrives after the password was changed and re-checked', async () => {
        // The first password's range is slow and says "leaked"; the visitor edits it into a clean
        // one before it lands. The late answer must not warn about a password no longer in the box.
        await driver.given.theRangeIsSlowToSay({ password: LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.given.theRangeIsCleanFor(ANOTHER_PASSWORD);
        await driver.when.created();
        await driver.type.password(LEAKED_PASSWORD);
        await driver.when.thePausePasses();
        await driver.type.password('1');
        await driver.when.thePausePasses();
        driver.assert.noWarningIsShown();
        await driver.when.theSlowRangeArrives();
        driver.assert.noWarningIsShown();
        driver.assert.rangesRequested(LEAKED_PREFIX, ANOTHER_PREFIX);
    });

    it("shows a soft couldn't-check note when the proxy fails, and does not block the field", async () => {
        await driver.given.theProxyFailsFor(LEAKED_PASSWORD);
        await driver.when.created();
        await driver.type.password(LEAKED_PASSWORD);
        await driver.when.thePausePasses();
        driver.assert.uncheckedNoteIsShown();
        driver.assert.noWarningIsShown();
        driver.assert.fieldIsEditable();
        driver.assert.checkFailureWasLogged();
    });

    it("shows the couldn't-check note when this browser has no Web Crypto, without a request or a crash", async () => {
        driver.given.theBrowserHasNoWebCrypto();
        await driver.when.created();
        await driver.type.password(LEAKED_PASSWORD);
        await driver.when.thePausePasses();
        driver.assert.uncheckedNoteIsShown();
        driver.assert.rangesRequested();
    });
});
