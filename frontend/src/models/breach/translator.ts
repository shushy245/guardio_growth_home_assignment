// Wire → model. The DTO types are the API's shape and live here, so nothing else in the app
// ever sees a raw response body.

import type {
    BreachHighlightModel,
    BreachModel,
    BreachPageModel,
    BreachSummaryModel,
    DataClassCountModel,
} from '~/models/breach/model';

export type BreachDTO = {
    name: string;
    title: string;
    domain?: string | undefined;
    breachDate: string;
    pwnCount: number;
    description: string;
    logoPath: string;
    dataClasses: string[];
    isVerified: boolean;
    isSensitive: boolean;
};

export type BreachPageDTO = {
    items: BreachDTO[];
    total: number;
    page: number;
    limit: number;
};

export type BreachHighlightDTO = {
    name: string;
    title: string;
    breachDate: string;
    pwnCount: number;
};

export type DataClassCountDTO = {
    dataClass: string;
    breachCount: number;
};

export type BreachSummaryDTO = {
    totalBreaches: number;
    totalAccountsExposed: number;
    breachesLast12Months: number;
    shareExposingPasswords: number;
    topDataClasses: DataClassCountDTO[];
    largestBreach: BreachHighlightDTO;
    mostRecentBreach: BreachHighlightDTO;
    // An ISO instant with its offset, unlike the calendar-day breach dates.
    syncedAt: string;
};

// `new Date('2013-01-01')` is parsed as UTC midnight, which is 31 December local time anywhere
// west of Greenwich — every January breach would show the wrong year. A breach date is a
// calendar day, not an instant, so it is built as local midnight on that day.
const toCalendarDay = (isoDate: string): Date => {
    const [year, month, day] = isoDate.split('-').map(Number);

    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

export const fromDTO = (dto: BreachDTO): BreachModel => ({
    ...dto,
    breachDate: toCalendarDay(dto.breachDate),
});

export const highlightFromDTO = (dto: BreachHighlightDTO): BreachHighlightModel => ({
    ...dto,
    breachDate: toCalendarDay(dto.breachDate),
});

export const dataClassCountFromDTO = (dto: DataClassCountDTO): DataClassCountModel => ({ ...dto });

export const pageFromDTO = (dto: BreachPageDTO): BreachPageModel => ({
    ...dto,
    items: dto.items.map(fromDTO),
});

export const summaryFromDTO = (dto: BreachSummaryDTO): BreachSummaryModel => ({
    ...dto,
    topDataClasses: dto.topDataClasses.map(dataClassCountFromDTO),
    largestBreach: highlightFromDTO(dto.largestBreach),
    mostRecentBreach: highlightFromDTO(dto.mostRecentBreach),
    syncedAt: new Date(dto.syncedAt),
});
