// Builders for the breach wire shapes.
//
// `with*` reassigns `this.state` to a fresh object and never mutates it in place: `build()`
// hands back the live object, so an in-place mutation would silently rewrite a DTO a previous
// `build()` already returned — a failure that surfaces nowhere near the builder.

import type { BreachDTO, BreachPageDTO, BreachSummaryDTO } from '~/models/breach';

const ADOBE: BreachDTO = {
    name: 'Adobe',
    title: 'Adobe',
    domain: 'adobe.com',
    breachDate: '2013-10-04',
    pwnCount: 152445165,
    description: 'Adobe accounts were exposed, along with password hints.',
    logoPath: 'https://logos.haveibeenpwned.com/Adobe.png',
    dataClasses: ['Email addresses', 'Password hints', 'Passwords'],
    isVerified: true,
    isSensitive: false,
};

class BreachDTOBuilder {
    private state: BreachDTO = { ...ADOBE };

    withName(name: string): this {
        this.state = { ...this.state, name, title: name };

        return this;
    }

    withBreachDate(breachDate: string): this {
        this.state = { ...this.state, breachDate };

        return this;
    }

    withDataClasses(...dataClasses: string[]): this {
        this.state = { ...this.state, dataClasses };

        return this;
    }

    withoutDomain(): this {
        this.state = { ...this.state, domain: undefined };

        return this;
    }

    build(): BreachDTO {
        return this.state;
    }
}

export const aBreachDTO = (): BreachDTOBuilder => new BreachDTOBuilder();

class BreachPageDTOBuilder {
    private state: BreachPageDTO = { items: [aBreachDTO().build()], total: 1, page: 1, limit: 20 };

    withItems(...items: BreachDTO[]): this {
        this.state = { ...this.state, items, total: items.length };

        return this;
    }

    withTotal(total: number): this {
        this.state = { ...this.state, total };

        return this;
    }

    build(): BreachPageDTO {
        return this.state;
    }
}

export const aBreachPageDTO = (): BreachPageDTOBuilder => new BreachPageDTOBuilder();

const CATALOG_SUMMARY: BreachSummaryDTO = {
    totalBreaches: 1031,
    totalAccountsExposed: 17713315945,
    breachesLast12Months: 102,
    shareExposingPasswords: 0.6508,
    topDataClasses: [
        { dataClass: 'Email addresses', breachCount: 1024 },
        { dataClass: 'Passwords', breachCount: 671 },
    ],
    largestBreach: { name: 'Adobe', title: 'Adobe', breachDate: '2013-10-04', pwnCount: 152445165 },
    mostRecentBreach: {
        name: 'ManchesterAirportsGroup',
        title: 'Manchester Airports Group',
        breachDate: '2026-08-27',
        pwnCount: 8849657,
    },
};

class BreachSummaryDTOBuilder {
    private state: BreachSummaryDTO = { ...CATALOG_SUMMARY };

    withTotalBreaches(totalBreaches: number): this {
        this.state = { ...this.state, totalBreaches };

        return this;
    }

    build(): BreachSummaryDTO {
        return this.state;
    }
}

export const aBreachSummaryDTO = (): BreachSummaryDTOBuilder => new BreachSummaryDTOBuilder();
