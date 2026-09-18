import { describe, expect, it } from 'vitest';

import { formatCount, formatInteger, formatShare, formatSyncedAgo } from '~/shared/format.utils';

describe('formatCount', () => {
    it('humanises billions, millions and thousands to one decimal', () => {
        expect(formatCount(17816217392)).toBe('17.8B');
        expect(formatCount(14936670)).toBe('14.9M');
        expect(formatCount(412000)).toBe('412K');
    });

    it('leaves a count under a thousand as it is', () => {
        expect(formatCount(950)).toBe('950');
        expect(formatCount(0)).toBe('0');
    });

    it('drops a trailing zero decimal', () => {
        expect(formatCount(2000000)).toBe('2M');
        expect(formatCount(1960000000)).toBe('2B');
    });
});

describe('formatInteger', () => {
    it('groups thousands for the results line', () => {
        expect(formatInteger(1036)).toBe('1,036');
        expect(formatInteger(20)).toBe('20');
    });
});

describe('formatShare', () => {
    it('shows a share of one as a whole percentage', () => {
        expect(formatShare(0.6508)).toBe('65%');
        expect(formatShare(1)).toBe('100%');
    });
});

describe('formatSyncedAgo', () => {
    const now = new Date('2026-09-19T12:00:00Z');

    it('says how long ago in the largest unit that fits', () => {
        expect(formatSyncedAgo({ syncedAt: new Date('2026-09-19T10:00:00Z'), now })).toBe('2 hours ago');
        expect(formatSyncedAgo({ syncedAt: new Date('2026-09-19T11:59:00Z'), now })).toBe('1 minute ago');
        expect(formatSyncedAgo({ syncedAt: new Date('2026-09-16T12:00:00Z'), now })).toBe('3 days ago');
    });

    it('says "just now" inside the first minute', () => {
        expect(formatSyncedAgo({ syncedAt: new Date('2026-09-19T11:59:30Z'), now })).toBe('just now');
    });
});
