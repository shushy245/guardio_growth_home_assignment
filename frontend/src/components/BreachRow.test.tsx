import { beforeEach, describe, it } from 'vitest';

import { aBreachDTO } from '~/testkit/builders';
import { type BreachRowDriver, makeBreachRowDriver } from '~/components/BreachRow.driver';

describe('BreachRow', () => {
    let driver: BreachRowDriver;

    beforeEach(() => {
        driver = makeBreachRowDriver();
    });

    it('singles out the Passwords badge and marks a verified breach as such', async () => {
        driver.given.theBreach(aBreachDTO().withDataClasses('Email addresses', 'Passwords').verified().build());
        await driver.when.created();
        driver.assert.badgeIsHighlighted('Passwords');
        driver.assert.badgeIsPlain('Email addresses');
        driver.assert.verifiedMarkIsShown();
    });

    it('shows no verified mark for an unverified breach', async () => {
        driver.given.theBreach(aBreachDTO().unverified().build());
        await driver.when.created();
        driver.assert.verifiedMarkIsNotShown();
    });

    it('reads the domain, the year and the humanised count on one line', async () => {
        driver.given.theBreach(aBreachDTO().build());
        await driver.when.created();
        driver.assert.titleReads('Adobe');
        driver.assert.metaReads('adobe.com · 2013 · 152.4M accounts');
    });

    it('leaves the domain out of the line for a breach that has none', async () => {
        driver.given.theBreach(aBreachDTO().withoutDomain().build());
        await driver.when.created();
        driver.assert.metaReads('2013 · 152.4M accounts');
    });
});

describe('BreachRow details', () => {
    let driver: BreachRowDriver;

    beforeEach(() => {
        driver = makeBreachRowDriver();
    });

    it('reveals the description when expanded and hides it again when collapsed', async () => {
        driver.given.theBreach(aBreachDTO().build());
        await driver.when.created();
        driver.assert.descriptionIsNotShown();
        driver.assert.toggleIsNamed('Show details');
        await driver.click.toggleDetails();
        driver.assert.descriptionIsShown('Adobe accounts were exposed, along with password hints.');
        driver.assert.toggleIsNamed('Hide details');
        await driver.click.toggleDetails();
        driver.assert.descriptionIsNotShown();
    });
});
