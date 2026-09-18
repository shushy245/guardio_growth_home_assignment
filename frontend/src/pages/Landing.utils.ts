// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum LandingTestIds {
    Page = 'LandingTestIds.Page',
    Scan = 'LandingTestIds.Scan',
}

// The three reasons to trust the scan, in the order the design lists them.
export const TRUST_POINTS: readonly string[] = [
    'Public breach data, sourced openly',
    'No email needed to scan',
    'Takes seconds',
];
