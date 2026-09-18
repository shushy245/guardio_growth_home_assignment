// The search field's testable surface: its ids, the pause it waits for, and the pure step from
// what is in the box to what is asked of the server. The component file exports only the component.

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum SearchFieldTestIds {
    Input = 'SearchFieldTestIds.Input',
}

// How long the visitor has to stop typing before the record is asked. Long enough that a word
// costs one request, short enough that the list answers before they look up.
export const SEARCH_DEBOUNCE_MS = 300;

export const SEARCH_PLACEHOLDER = 'Search by name or domain';
export const SEARCH_LABEL = 'Search breaches';

// An empty or blank box is no search at all, never a search for the empty string.
export const toQuery = (text: string): string | undefined => {
    const trimmed = text.trim();

    return trimmed === '' ? undefined : trimmed;
};
