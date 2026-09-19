// The filter bar's testable surface: its ids, the sort options and the pure rules that read the
// current filters back into the controls. The component file exports only the component.

import { formatInteger } from '~/shared/format.utils';
import { BreachSortColumn, SortOrder } from '~/models/breach';
import type { CatalogFilters } from '~/providers/BreachCatalogProvider.utils';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum BreachFiltersTestIds {
    VerifiedOnly = 'BreachFiltersTestIds.VerifiedOnly',
    ResultsLine = 'BreachFiltersTestIds.ResultsLine',
    ClearFilters = 'BreachFiltersTestIds.ClearFilters',
}

export const sortSegmentTestId = (option: SortOption): string => `BreachFiltersTestIds.Sort.${option}`;
export const dataClassChipTestId = (dataClass: string): string => `BreachFiltersTestIds.Chip.${dataClass}`;

// The three sorts the design offers, in the order its segmented control shows them.
export enum SortOption {
    Newest = 'Newest',
    MostAccounts = 'MostAccounts',
    Name = 'Name',
}

export const sortLabelMap: Record<SortOption, string> = {
    [SortOption.Newest]: 'Newest',
    [SortOption.MostAccounts]: 'Most accounts',
    [SortOption.Name]: 'Name',
};

type SortSelection = Pick<CatalogFilters, 'sort' | 'order'>;

// Newest is the server's default, so it sends nothing: the URL and the history stay clean, and
// the two vocabularies (ours and the API's) meet in this one table.
export const sortOptionMap: Record<SortOption, SortSelection> = {
    [SortOption.Newest]: { sort: undefined, order: undefined },
    [SortOption.MostAccounts]: { sort: BreachSortColumn.PwnCount, order: SortOrder.Desc },
    [SortOption.Name]: { sort: BreachSortColumn.Name, order: SortOrder.Asc },
};

const matchesSelection = (filters: CatalogFilters, selection: SortSelection): boolean =>
    filters.sort === selection.sort && filters.order === selection.order;

// Which segment is lit for the filters in force. Read back from the filters rather than kept as
// its own state, so the control can never disagree with the query that was sent.
export const activeSortOption = (filters: CatalogFilters): SortOption =>
    Object.values(SortOption).find((option) => matchesSelection(filters, sortOptionMap[option])) ?? SortOption.Newest;

export const isDataClassSelected = (filters: CatalogFilters, dataClass: string): boolean =>
    filters.dataClass === dataClass;

// A filter narrows the record; the sort only orders it, so "Clear filters" is not offered for a
// sort alone.
export const hasActiveFilters = (filters: CatalogFilters): boolean =>
    filters.q !== undefined || filters.dataClass !== undefined || filters.verifiedOnly === true;

export const formatResultsLine = ({ shown, total }: { shown: number; total: number }): string =>
    `Showing ${formatInteger(shown)} of ${formatInteger(total)}`;

// Clearing keeps the order the visitor chose and drops everything that narrows the record.
export const withoutFilters = (filters: CatalogFilters): CatalogFilters => ({
    sort: filters.sort,
    order: filters.order,
});

export const VERIFIED_ONLY_LABEL = 'Verified only';
export const CLEAR_FILTERS_LABEL = 'Clear filters';
