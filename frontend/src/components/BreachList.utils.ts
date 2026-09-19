// The list's testable surface: its ids and the copy of its two non-row states. The component
// file exports only the component.

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum BreachListTestIds {
    Rows = 'BreachListTestIds.Rows',
    Skeleton = 'BreachListTestIds.Skeleton',
    EmptyFilter = 'BreachListTestIds.EmptyFilter',
    ClearFilters = 'BreachListTestIds.ClearFilters',
    LoadMore = 'BreachListTestIds.LoadMore',
}

// Three skeleton rows: enough to read as a list, not so many the page grows past what will
// replace them.
export const SKELETON_ROW_COUNT = 3;

export const LOAD_MORE_LABEL = 'Load more';
export const LOADING_MORE_LABEL = 'Loading more…';

export const EMPTY_FILTER_TITLE = 'No breaches match your filters';
export const EMPTY_FILTER_DESCRIPTION = 'Try a different search term, or clear your filters to see the whole record.';

export const LIST_FAILED_TITLE = "Couldn't load breaches";
export const LIST_FAILED_DESCRIPTION = 'Something went wrong loading the breach record.';
export const LIST_RETRY_LABEL = 'Retry';
