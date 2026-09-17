import { describe, expect, it } from 'vitest';

import { joinClassNames } from '~/ui/box.utils';

describe('joinClassNames', () => {
    it('joins the names it is given with a single space', () => {
        expect(joinClassNames('row', 'promo')).toBe('row promo');
    });

    it('drops an undefined name so no stray space reaches the DOM', () => {
        expect(joinClassNames('row', undefined)).toBe('row');
    });

    it('drops an empty name, which is what a conditional className evaluates to', () => {
        expect(joinClassNames('row', '')).toBe('row');
    });

    it('is an empty string when every name is absent', () => {
        expect(joinClassNames(undefined)).toBe('');
    });
});
