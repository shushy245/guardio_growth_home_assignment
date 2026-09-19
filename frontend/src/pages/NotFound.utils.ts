// The not-found page's testable surface: its ids, its copy and the route it sends a visitor
// back to. The component file exports only the component.

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum NotFoundTestIds {
    Page = 'NotFoundTestIds.Page',
}

export const NOT_FOUND_TITLE = 'That page is not here';
export const NOT_FOUND_DESCRIPTION =
    'The link may be old, or the address may have a typo. The scan is where everything starts.';
export const NOT_FOUND_ACTION_LABEL = 'Go to the scan';
