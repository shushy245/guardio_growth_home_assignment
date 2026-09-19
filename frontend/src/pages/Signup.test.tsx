import { beforeEach, describe, it } from 'vitest';

import { Plan } from '~/models/signup';
import { FunnelEventName } from '~/models/funnelEvent';
import { makeSignupDriver, type SignupDriver } from '~/pages/Signup.driver';
import { EMAIL_TAKEN_MESSAGE, SIGNUP_FAILED_MESSAGE } from '~/pages/Signup.utils';

const AN_EMAIL = 'ada@example.com';
const A_CLEAN_PASSWORD = 'correct horse battery staple';
const A_LEAKED_PASSWORD = 'password';
const LEAK_COUNT = 3120000;

describe('Signup', () => {
    let driver: SignupDriver;

    beforeEach(() => {
        driver = makeSignupDriver();
    });

    it('records signup_started once on arrival', async () => {
        await driver.when.created();
        await driver.assert.stepsPosted(FunnelEventName.SignupStarted, 1);
    });

    it('submits the email, the chosen plan, the password and a clean check, then moves to the confirmation', async () => {
        driver.given.theSignupSucceeds();
        await driver.given.theRangeIsCleanFor(A_CLEAN_PASSWORD);
        await driver.when.created();
        await driver.click.plan(Plan.Basic);
        await driver.type.email(AN_EMAIL);
        await driver.type.password(A_CLEAN_PASSWORD);
        await driver.click.submit();
        driver.assert.signupSent({
            email: AN_EMAIL,
            plan: Plan.Basic,
            password: A_CLEAN_PASSWORD,
            passwordWasPwned: false,
        });
        await driver.assert.protectedRouteIsShownFor(Plan.Basic);
    });

    it('still submits a leaked password, flagged as leaked, and moves on', async () => {
        driver.given.theSignupSucceeds();
        await driver.given.theRangeSays({ password: A_LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.when.created();
        await driver.type.email(AN_EMAIL);
        await driver.type.password(A_LEAKED_PASSWORD);
        await driver.assert.leakedWarningIsShown();
        await driver.click.submit();
        driver.assert.signupSent({
            email: AN_EMAIL,
            plan: Plan.Family,
            password: A_LEAKED_PASSWORD,
            passwordWasPwned: true,
        });
        await driver.assert.protectedRouteIsShownFor(Plan.Family);
    });

    it('does not carry a warning for an earlier password onto the one actually submitted', async () => {
        // "password" was found leaked; the visitor then types a different password whose check has
        // not answered yet and submits. What is sent is about the password in the box, not the old one.
        driver.given.theSignupSucceeds();
        await driver.given.theRangeSays({ password: A_LEAKED_PASSWORD, count: LEAK_COUNT });
        await driver.given.theRangeIsSlowToSay({ password: A_CLEAN_PASSWORD, count: 1 });
        await driver.when.created();
        await driver.type.email(AN_EMAIL);
        await driver.type.password(A_LEAKED_PASSWORD);
        await driver.assert.leakedWarningIsShown();
        await driver.clear.password();
        await driver.type.password(A_CLEAN_PASSWORD);
        await driver.click.submit();
        driver.assert.signupSent({
            email: AN_EMAIL,
            plan: Plan.Family,
            password: A_CLEAN_PASSWORD,
            passwordWasPwned: false,
        });
    });

    it('sends one sign-up on a double tap: the button is busy while the request is in flight', async () => {
        driver.given.theSignupHangs();
        await driver.given.theRangeIsCleanFor(A_CLEAN_PASSWORD);
        await driver.when.created();
        await driver.type.email(AN_EMAIL);
        await driver.type.password(A_CLEAN_PASSWORD);
        await driver.click.submitTwice();
        await driver.assert.submitIsBusy();
        driver.assert.signupsSent(1);
        await driver.when.theSignupResponds();
        await driver.assert.protectedRouteIsShownFor(Plan.Family);
    });

    it('shows the inline messages for an invalid email and a short password, and sends nothing', async () => {
        driver.given.theSignupSucceeds();
        await driver.when.created();
        await driver.type.email('not-an-email');
        await driver.type.password('short');
        await driver.click.submit();
        driver.assert.emailErrorIsShown();
        driver.assert.passwordErrorIsShown();
        driver.assert.signupsSent(0);
    });

    it('tells the visitor when the email already has an account, and keeps the form editable', async () => {
        driver.given.theEmailIsTaken();
        await driver.given.theRangeIsCleanFor(A_CLEAN_PASSWORD);
        await driver.when.created();
        await driver.type.email(AN_EMAIL);
        await driver.type.password(A_CLEAN_PASSWORD);
        await driver.click.submit();
        await driver.assert.serverMessageIsShown(EMAIL_TAKEN_MESSAGE);
        driver.assert.submitIsOffered();
    });

    it('shows one retryable failure for anything else the server refuses, and logs the detail', async () => {
        driver.given.theSignupFails();
        await driver.given.theRangeIsCleanFor(A_CLEAN_PASSWORD);
        await driver.when.created();
        await driver.type.email(AN_EMAIL);
        await driver.type.password(A_CLEAN_PASSWORD);
        await driver.click.submit();
        await driver.assert.serverMessageIsShown(SIGNUP_FAILED_MESSAGE);
        driver.assert.submitIsOffered();
        driver.assert.failureWasLogged();
    });
});
