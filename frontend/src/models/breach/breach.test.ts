import { describe, expect, it } from 'vitest';

import { aBreachDTO, aBreachSummaryDTO } from '~/testkit/builders';
import { breachYear, fromDTO, hasLeakedPasswords, summaryFromDTO } from '~/models/breach';

describe('breach.fromDTO', () => {
    it('parses the breach date into the calendar day it names', () => {
        const breach = fromDTO(aBreachDTO().withBreachDate('2013-10-04').build());

        expect(breach.breachDate).toStrictEqual(new Date(2013, 9, 4));
    });

    it('keeps a January breach in its own year in a timezone behind UTC', () => {
        // `new Date('2013-01-01')` is UTC midnight, which is 31 December locally anywhere west
        // of Greenwich — the year on the screen would be off by one for every January breach.
        const breach = fromDTO(aBreachDTO().withBreachDate('2013-01-01').build());

        expect(breachYear(breach)).toBe(2013);
    });

    it('carries the data classes through', () => {
        const breach = fromDTO(aBreachDTO().withDataClasses('Email addresses', 'Passwords').build());

        expect(breach.dataClasses).toStrictEqual(['Email addresses', 'Passwords']);
    });

    it('reads an absent domain as undefined', () => {
        const breach = fromDTO(aBreachDTO().withoutDomain().build());

        expect(breach.domain).toBeUndefined();
    });
});

describe('breach selectors', () => {
    it('says a breach that leaked passwords did', () => {
        expect(hasLeakedPasswords(fromDTO(aBreachDTO().withDataClasses('Passwords').build()))).toBe(true);
    });

    it('says a breach that leaked no passwords did not', () => {
        expect(hasLeakedPasswords(fromDTO(aBreachDTO().withDataClasses('Email addresses').build()))).toBe(false);
    });
});

describe('breach.summaryFromDTO', () => {
    it('parses the dates on both highlighted breaches', () => {
        const summary = summaryFromDTO(aBreachSummaryDTO().build());

        expect(summary.largestBreach.breachDate).toStrictEqual(new Date(2013, 9, 4));
        expect(summary.mostRecentBreach.breachDate).toStrictEqual(new Date(2026, 7, 27));
    });

    it('carries the ranked data classes through in order', () => {
        const summary = summaryFromDTO(aBreachSummaryDTO().build());

        expect(summary.topDataClasses.map((item) => item.dataClass)).toStrictEqual(['Email addresses', 'Passwords']);
    });
});
