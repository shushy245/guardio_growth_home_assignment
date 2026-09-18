// The scan page's testable surface: its test ids, the length of the moment, and where it leads.

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum ScanTestIds {
    Page = 'ScanTestIds.Page',
    Scanning = 'ScanTestIds.Scanning',
}

// How long the scanning state is held at minimum, so the moment reads as a check rather than a
// flash. The progress bar in Scan.module.scss fills over `tokens.$scan-moment`, the same two
// seconds written for CSS — change both or the bar will finish before or after the page does.
export const SCAN_MOMENT_MS = 2000;

// Where the moment leads. The route table in App is the other reader of this path.
export const RESULT_ROUTE = '/result';

export const SCAN_FAILED_TITLE = "We couldn't reach the breach record";
export const SCAN_FAILED_DESCRIPTION = 'Try again in a moment.';
export const SCAN_RETRY_LABEL = 'Try again';
