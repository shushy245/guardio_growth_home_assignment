import { describe, expect, it } from 'vitest';

import { shareOfFirst } from '~/charts/FunnelBars.utils';

describe('shareOfFirst', () => {
    it('sizes each step against the first one, so the first bar is always full', () => {
        expect(shareOfFirst([1250, 1000, 80])).toStrictEqual([1, 0.8, 0.064]);
    });

    it('sizes every bar at zero when nobody reached the first step, never dividing by zero', () => {
        expect(shareOfFirst([0, 0, 0])).toStrictEqual([0, 0, 0]);
    });
});
