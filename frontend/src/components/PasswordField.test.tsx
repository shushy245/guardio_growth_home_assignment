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
