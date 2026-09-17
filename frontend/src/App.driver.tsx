import { expect } from 'vitest';
import { screen } from '@testing-library/react';

import { App } from '~/App';
import { LandingTestIds } from '~/pages/Landing.utils';
import { renderWithProviders } from '~/testkit/renderWithProviders';

export type AppDriver = {
    given: { route: (path: string) => void };
    when: { created: () => void };
    assert: { landingIsShown: () => void };
};

export const makeAppDriver = (): AppDriver => {
    let route = '/';

    return {
        given: {
            route: (path: string): void => {
                route = path;
            },
        },
        when: {
            created: (): void => {
                renderWithProviders(<App />, { route });
            },
        },
        assert: {
            landingIsShown: (): void => {
                expect(screen.getByTestId(LandingTestIds.Page)).toBeInTheDocument();
            },
        },
    };
};
