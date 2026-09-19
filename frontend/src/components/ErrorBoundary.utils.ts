// The boundary's testable surface: its copy and the shape of its state. The component file
// exports only the component.

export const RENDER_FAILURE_TITLE = 'Something went wrong on this screen';
export const RENDER_FAILURE_DESCRIPTION =
    'The page stopped before it finished rendering. Reloading usually clears it; if it keeps happening, the details are in the browser console.';
export const RENDER_FAILURE_ACTION_LABEL = 'Reload the page';

// A throw is not a value the tree can carry on with, so the boundary holds one bit and nothing
// else: the thrown error itself is on-call detail and goes to the log, never to the screen.
export type ErrorBoundaryState = { hasFailed: boolean };

export const NOT_FAILED: ErrorBoundaryState = { hasFailed: false };
export const FAILED: ErrorBoundaryState = { hasFailed: true };
