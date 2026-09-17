import { beforeEach, describe, it } from 'vitest';

import { BoxDriver, makeBoxDriver, Primitive } from '~/ui/box.driver';

describe('layout primitives', () => {
    let driver: BoxDriver;

    beforeEach(() => {
        driver = makeBoxDriver();
    });

    it('Row lays its children out horizontally', async () => {
        driver.given.primitive(Primitive.Row);
        await driver.when.created();
        driver.assert.hasClass('row');
    });

    it('Column lays its children out vertically', async () => {
        driver.given.primitive(Primitive.Column);
        await driver.when.created();
        driver.assert.hasClass('column');
    });

    it('FullRow is a Row stretched to full width', async () => {
        driver.given.primitive(Primitive.FullRow);
        await driver.when.created();
        driver.assert.hasClass('fullRow');
    });

    it('FullColumn is a Column stretched to full height', async () => {
        driver.given.primitive(Primitive.FullColumn);
        await driver.when.created();
        driver.assert.hasClass('fullColumn');
    });

    it('FullBox fills both dimensions', async () => {
        driver.given.primitive(Primitive.FullBox);
        await driver.when.created();
        driver.assert.hasClass('fullBox');
    });

    it('Box adds no layout class of its own', async () => {
        driver.given.primitive(Primitive.Box);
        await driver.when.created();
        driver.assert.hasNoLayoutClass();
    });

    it('every primitive renders its children', async () => {
        driver.given.primitive(Primitive.Row);
        await driver.when.created();
        driver.assert.rendersChildren();
    });
});
