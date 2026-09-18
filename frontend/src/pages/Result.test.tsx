import { beforeEach, describe, it } from 'vitest';

import { Tone } from '~/models/featureFlag';
import { aVisitorDTO } from '~/testkit/builders';
import { makeResultDriver, type ResultDriver } from '~/pages/Result.driver';

const RESULT_SCREEN_TONE = 'result_screen_tone';

describe('Result', () => {
    let driver: ResultDriver;

    beforeEach(() => {
        driver = makeResultDriver();
    });

    it('frames the record calmly for a visitor assigned the calm variant', async () => {
        driver.given.theVisitorIsAssigned(aVisitorDTO().assignedTo(RESULT_SCREEN_TONE, 'calm').build());
        await driver.when.created();
        await driver.assert.headlineReads('Known breaches');
        await driver.assert.subheadlineReads("Here's the public record of data breaches.");
        await driver.assert.ctaReads('Protect me');
    });

    it('frames the record urgently for a visitor assigned the urgent variant', async () => {
        driver.given.theVisitorIsAssigned(aVisitorDTO().assignedTo(RESULT_SCREEN_TONE, 'urgent').build());
        await driver.when.created();
        await driver.assert.headlineReads("You're exposed!");
        await driver.assert.subheadlineReads('17.7B accounts have leaked. Yours could be among them.');
        await driver.assert.ctaReads('Protect me now');
    });

    it('carries the urgent tone on the root so the CTA is recoloured by the stylesheet alone', async () => {
        driver.given.theVisitorIsAssigned(aVisitorDTO().assignedTo(RESULT_SCREEN_TONE, 'urgent').build());
        await driver.when.created();
        await driver.assert.toneIs(Tone.Urgent);
    });

    it('carries the calm tone on the root for the calm variant', async () => {
        driver.given.theVisitorIsAssigned(aVisitorDTO().assignedTo(RESULT_SCREEN_TONE, 'calm').build());
        await driver.when.created();
        await driver.assert.toneIs(Tone.Calm);
    });
});

describe('Result for a visitor outside the experiment', () => {
    let driver: ResultDriver;

    beforeEach(() => {
        driver = makeResultDriver();
    });

    it('shows the control framing to a visitor the flag never assigned', async () => {
        driver.given.theVisitorIsAssigned(aVisitorDTO().withoutAssignments().build());
        await driver.when.created();
        await driver.assert.headlineReads('Known breaches');
        await driver.assert.ctaReads('Protect me');
        await driver.assert.toneIs(Tone.Calm);
    });

    it('still shows a working result screen when the visitor session fails', async () => {
        driver.given.theVisitorSessionFails();
        await driver.when.created();
        await driver.assert.headlineReads('Known breaches');
        await driver.assert.ctaReads('Protect me');
        await driver.assert.toneIs(Tone.Calm);
    });
});
