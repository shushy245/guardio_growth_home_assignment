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
    Strict = 'strict',
    Plain = 'plain',
}

const wrap = (tree: ReactElement, mode: RenderMode): ReactElement =>
    mode === RenderMode.Strict ? <StrictMode>{tree}</StrictMode> : tree;

export const renderWithProviders = (
    ui: ReactElement,
    { route = '/', mode = RenderMode.Plain }: { route?: string; mode?: RenderMode } = {},
): void => {
    render(wrap(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>, mode));
};
