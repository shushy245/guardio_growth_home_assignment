import { act } from 'react';
import { expect } from 'vitest';
import { screen } from '@testing-library/react';

import { App } from '~/App';
import { AdminTestIds } from '~/pages/Admin.utils';
import { LandingTestIds } from '~/pages/Landing.utils';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { renderWithProviders } from '~/testkit/renderWithProviders';

export type AppDriver = {
    given: { route: (path: string) => void };
    when: { created: () => Promise<void> };
    assert: {
        landingIsShown: () => void;
        adminIsShown: () => void;
        visitorsCreated: (count: number) => void;
        flagListsFetched: (count: number) => void;
    };
};

const requestsTo = (method: HttpMethod, path: string): number =>
    fakeHttp.requests().filter((request) => request.method === method && request.path === path).length;

export const makeAppDriver = (): AppDriver => {
    let route = '/';

    return {
        given: {
            route: (path: string): void => {
                route = path;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(<App />, { route });
                });
            },
        },
        assert: {
            landingIsShown: (): void => {
                expect(screen.getByTestId(LandingTestIds.Page)).toBeInTheDocument();
            },
            adminIsShown: (): void => {
                expect(screen.getByTestId(AdminTestIds.Page)).toBeInTheDocument();
            },
            visitorsCreated: (count: number): void => {
                expect(requestsTo(HttpMethod.Post, '/visitors')).toBe(count);
            },
            flagListsFetched: (count: number): void => {
                expect(requestsTo(HttpMethod.Get, '/feature-flags')).toBe(count);
            },
        },
    };
};
