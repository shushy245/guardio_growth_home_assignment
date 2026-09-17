import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { render } from '@testing-library/react';

// Every render in a test goes through here so the provider stack matches production.
// Providers are added as stories introduce them (visitor, analytics).
// Returns nothing on purpose: the driver is the only thing a test talks to, so handing back a
// RenderResult would open a second, untyped route into the DOM.
export const renderWithProviders = (ui: ReactElement, { route }: { route: string } = { route: '/' }): void => {
    render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
};
