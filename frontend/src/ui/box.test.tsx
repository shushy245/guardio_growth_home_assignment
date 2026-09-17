import { beforeEach, describe, it } from 'vitest';

import { BoxDriver, makeBoxDriver, Primitive } from '~/ui/box.driver';

describe('layout primitives', () => {
    let driver: BoxDriver;

    beforeEach(() => {
        driver = makeBoxDriver();
    });

    it('Row lays its children out horizontally', () => {
        driver.given.primitive(Primitive.Row);
        driver.when.created();
        driver.assert.hasClass('row');
    });

    it('Column lays its children out vertically', () => {
        driver.given.primitive(Primitive.Column);
        driver.when.created();
        driver.assert.hasClass('column');
    });

    it('FullRow is a Row stretched to full width', () => {
        driver.given.primitive(Primitive.FullRow);
        driver.when.created();
        driver.assert.hasClass('fullRow');
    });

    it('FullColumn is a Column stretched to full height', () => {
        driver.given.primitive(Primitive.FullColumn);
        driver.when.created();
        driver.assert.hasClass('fullColumn');
    });

    it('FullBox fills both dimensions', () => {
        driver.given.primitive(Primitive.FullBox);
        driver.when.created();
        driver.assert.hasClass('fullBox');
    });

    it('Box adds no layout class of its own', () => {
        driver.given.primitive(Primitive.Box);
        driver.when.created();
        driver.assert.hasNoLayoutClass();
    });

    it('every primitive renders its children', () => {
        driver.given.primitive(Primitive.Row);
        driver.when.created();
        driver.assert.rendersChildren();
    });
});
