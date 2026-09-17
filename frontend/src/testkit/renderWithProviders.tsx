import { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { render, RenderResult } from '@testing-library/react';

// Every render in a test goes through here so the provider stack matches production.
// Providers are added as stories introduce them (visitor, analytics).
export const renderWithProviders = (
    ui: ReactElement,
    { route }: { route: string } = { route: '/' },
): RenderResult => render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>);
