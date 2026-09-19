import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';
import { type ReactElement, StrictMode } from 'react';

// Every render in a test goes through here so the render stack matches production: the router,
// and StrictMode when the test asks for it. The visitor session is deliberately *not* here —
// it is scoped to the funnel routes inside `App`, so a driver that needs it wraps its own
// subject the way the funnel does, and a driver that does not gets no visitor.
// Returns nothing on purpose: the driver is the only thing a test talks to, so handing back a
// RenderResult would open a second, untyped route into the DOM.

export enum RenderMode {
    // What production ships: main.tsx wraps the app in StrictMode, so effects double-run in dev.
    // It is the default here for the same reason — a driver that renders plain certifies as
    // single what is double in the mode the app actually runs in, which is how the admin page's
    // double fetch survived a test named "once" (BF58, BF87).
    Strict = 'strict',
    // Opt out only where StrictMode's second mount is what the test is measuring around, and
    // say why at the call site.
    Plain = 'plain',
}

const wrap = (tree: ReactElement, mode: RenderMode): ReactElement =>
    mode === RenderMode.Strict ? <StrictMode>{tree}</StrictMode> : tree;

// `state` is what a navigation carried (`navigate(to, { state })`): the confirmation page reads
// the plan from it, so a driver can open that page the way the sign-up leaves it.
export const renderWithProviders = (
    ui: ReactElement,
    { route = '/', state, mode = RenderMode.Strict }: { route?: string; state?: unknown; mode?: RenderMode } = {},
): void => {
    const entry = state === undefined ? route : { pathname: route, state };
    render(wrap(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>, mode));
};
