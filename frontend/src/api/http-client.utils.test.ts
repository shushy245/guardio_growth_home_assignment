import { describe, expect, it } from 'vitest';

import { normaliseNulls } from '~/api/http-client.utils';

describe('normaliseNulls', () => {
    it('turns a top-level null into undefined', () => {
        expect(normaliseNulls(null)).toBeUndefined();
    });

    it('turns a null inside an object into undefined', () => {
        expect(normaliseNulls({ domain: null, name: 'Adobe' })).toStrictEqual({ domain: undefined, name: 'Adobe' });
    });

    it('turns a null nested deeper in an object into undefined', () => {
        expect(normaliseNulls({ breach: { domain: null } })).toStrictEqual({ breach: { domain: undefined } });
    });

    it('turns nulls inside an array into undefined', () => {
        expect(normaliseNulls([null, 'adobe', { domain: null }])).toStrictEqual([
            undefined,
            'adobe',
            { domain: undefined },
        ]);
    });

    it('passes a value that contains no null through unchanged', () => {
        expect(normaliseNulls({ pwnCount: 0, isVerified: false, dataClasses: ['Passwords'] })).toStrictEqual({
            pwnCount: 0,
            isVerified: false,
            dataClasses: ['Passwords'],
        });
    });
});
