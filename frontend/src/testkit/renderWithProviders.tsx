import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';
import { type ReactElement, StrictMode } from 'react';

import { VisitorProvider } from '~/providers/VisitorProvider';

// Every render in a test goes through here so the provider stack matches production.
// Providers are added as stories introduce them (visitor, analytics).
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
    render(
        wrap(
            <MemoryRouter initialEntries={[route]}>
                <VisitorProvider>{ui}</VisitorProvider>
            </MemoryRouter>,
            mode,
        ),
    );
};
