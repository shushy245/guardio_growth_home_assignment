import { describe, expect, it } from 'vitest';

import { formatPValue, formatSignedPercent } from '~/components/LiftCard.utils';

describe('formatSignedPercent', () => {
    it('writes a positive lift with its sign and one decimal', () => {
        expect(formatSignedPercent(0.25)).toBe('+25.0%');
    });

    it('writes a negative lift with a real minus sign', () => {
        expect(formatSignedPercent(-0.0559)).toBe('−5.6%');
    });

    it('writes a zero lift without a sign', () => {
        expect(formatSignedPercent(0)).toBe('0.0%');
    });
});

describe('formatPValue', () => {
    it('writes three decimals for a p-value a reader can weigh', () => {
        expect(formatPValue(0.11813)).toBe('p = 0.118');
    });

    it('writes a floor instead of a string of zeros for a vanishing p-value', () => {
        expect(formatPValue(0.0000058)).toBe('p < 0.001');
    });
});
