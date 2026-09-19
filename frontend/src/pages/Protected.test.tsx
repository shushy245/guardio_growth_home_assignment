import { beforeEach, describe, it } from 'vitest';

import { Plan } from '~/models/signup';
import { FunnelEventName } from '~/models/funnelEvent';
import { makeProtectedDriver, type ProtectedDriver } from '~/pages/Protected.driver';

describe('Protected', () => {
    let driver: ProtectedDriver;

    beforeEach(() => {
        driver = makeProtectedDriver();
    });

    it('confirms the plan that was signed up for and records activation once on arrival', async () => {
        driver.given.aSignupFor(Plan.Family);
        await driver.when.created();
        driver.assert.confirmationIsShownFor(Plan.Family);
        driver.assert.nextStepsRead(['Install the extension', 'Add a family member']);
        driver.assert.backToResultsLeadsToTheResultScreen();
        await driver.assert.stepsPosted(FunnelEventName.Activation, 1);
    });

    it('confirms the Basic plan with its own next steps', async () => {
        driver.given.aSignupFor(Plan.Basic);
        await driver.when.created();
        driver.assert.confirmationIsShownFor(Plan.Basic);
        driver.assert.nextStepsRead(['Install the extension', 'Turn on breach alerts']);
    });

    it('sends a visit with no sign-up behind it back to the sign-up, recording nothing', async () => {
        await driver.when.created();
        driver.assert.signupRouteIsShown();
        driver.assert.noStepPosted(FunnelEventName.Activation);
    });
});
