// Types and enums only — no logic. `translator.ts` builds these, `selectors.ts` reads them.

export type BreachModel = {
    name: string;
    title: string;
    // Absent for 54 of HIBP's 1,036 records. Declared `?: T | undefined` rather than `?: T`
    // because `exactOptionalPropertyTypes` rejects an explicit `undefined` for the latter, and
    // the axios seam produces exactly that when it normalises JSON null.
    domain?: string | undefined;
    breachDate: Date;
    pwnCount: number;
    description: string;
    logoPath: string;
    dataClasses: string[];
    isVerified: boolean;
    isSensitive: boolean;
};

export type BreachHighlightModel = {
    name: string;
    title: string;
    breachDate: Date;
    pwnCount: number;
};

export type DataClassCountModel = {
    dataClass: string;
    breachCount: number;
};

export type BreachSummaryModel = {
    totalBreaches: number;
    totalAccountsExposed: number;
    breachesLast12Months: number;
    shareExposingPasswords: number;
    topDataClasses: DataClassCountModel[];
    largestBreach: BreachHighlightModel;
    mostRecentBreach: BreachHighlightModel;
    // When the stored copy of the public record was last refreshed — the age of every tile.
    syncedAt: Date;
};

export type BreachPageModel = {
    items: BreachModel[];
    total: number;
    page: number;
    limit: number;
};

// The values are the API's, not ours to choose: each member is the string the backend's
// BreachSort enum accepts, and sending anything else is a 400 rather than a silent default.
export enum BreachSortColumn {
    BreachDate = 'breachDate',
    PwnCount = 'pwnCount',
    Name = 'name',
}

export enum SortOrder {
    Asc = 'asc',
    Desc = 'desc',
}

export type BreachFilters = {
    page?: number | undefined;
    limit?: number | undefined;
    sort?: BreachSortColumn | undefined;
    order?: SortOrder | undefined;
    q?: string | undefined;
    dataClass?: string | undefined;
    verifiedOnly?: boolean | undefined;
};

export const PASSWORDS_DATA_CLASS = 'Passwords';
