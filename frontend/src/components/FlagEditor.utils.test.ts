import { describe, expect, it } from 'vitest';

import { WEIGHT_TOTAL } from '~/models/featureFlag';
import { clampWeight } from '~/components/FlagEditor.utils';

describe('clampWeight', () => {
    it('reads a cleared box as nothing assigned, never as the whole split', () => {
        // A `type=number` input hands over whatever is in it, including "". Reading that as 100
        // would silently give one variant the entire split the moment the operator selects the
        // number to retype it, and the save that follows would look deliberate (BF84).
        expect(clampWeight('')).toBe(0);
        expect(clampWeight('not a number')).toBe(0);
    });

    it('holds a weight inside the split it is a share of', () => {
        expect(clampWeight('101')).toBe(WEIGHT_TOTAL);
        expect(clampWeight('-5')).toBe(0);
        expect(clampWeight('50')).toBe(50);
    });
});
