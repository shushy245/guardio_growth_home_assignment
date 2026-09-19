import { beforeEach, describe, it } from 'vitest';

import { Plan } from '~/models/signup';
import { makePlanPickerDriver, type PlanPickerDriver } from '~/components/PlanPicker.driver';

describe('PlanPicker', () => {
    let driver: PlanPickerDriver;

    beforeEach(() => {
        driver = makePlanPickerDriver();
    });

    it('offers both plans with the current one selected', async () => {
        driver.given.theCurrentPlan(Plan.Family);
        await driver.when.created();
        driver.assert.bothPlansAreOffered();
        driver.assert.selectedPlanIs(Plan.Family);
    });

    it('selects exactly one plan: tapping the other card moves the choice and reports it', async () => {
        driver.given.theCurrentPlan(Plan.Family);
        await driver.when.created();
        await driver.click.plan(Plan.Basic);
        driver.assert.selectedPlanIs(Plan.Basic);
        driver.assert.changedTo(Plan.Basic);
    });

    it('tapping the plan already chosen changes nothing', async () => {
        driver.given.theCurrentPlan(Plan.Family);
        await driver.when.created();
        await driver.click.plan(Plan.Family);
        driver.assert.selectedPlanIs(Plan.Family);
        driver.assert.changedTo();
    });
});
