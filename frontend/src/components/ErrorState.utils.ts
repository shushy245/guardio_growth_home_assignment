// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum ErrorStateTestIds {
    Root = 'ErrorStateTestIds.Root',
    Retry = 'ErrorStateTestIds.Retry',
}

// Whether this state is a panel inside a page that has a heading of its own, or the whole of
// what the page has to say. A page needs exactly one `h1` and a panel must not add a second, so
// the title's element follows the answer rather than being fixed for both (visual pass, V2).
export enum ErrorStateKind {
    Panel = 'panel',
    Page = 'page',
}
