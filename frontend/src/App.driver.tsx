import { screen } from '@testing-library/react';
import { expect } from 'vitest';

import { App } from '~/App';
import { LandingTestIds } from '~/pages/Landing.utils';
import { renderWithProviders } from '~/testkit/renderWithProviders';

export const makeAppDriver = () => {
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
