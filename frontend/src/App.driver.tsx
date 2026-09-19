import { act } from 'react';
import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { App } from '~/App';
import { AdminTestIds } from '~/pages/Admin.utils';
import { SignupTestIds } from '~/pages/Signup.utils';
import { LandingTestIds } from '~/pages/Landing.utils';
import { FunnelEventName } from '~/models/funnelEvent';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { postedSteps, respondToFunnelEvents } from '~/testkit/funnel-events';

export type AppDriver = {
    given: { route: (path: string) => void };
    when: { created: () => Promise<void> };
    assert: {
        landingIsShown: () => void;
        adminIsShown: () => void;
        signupIsShown: () => void;
        visitorsCreated: (count: number) => void;
        flagListsFetched: (count: number) => void;
        stepsPosted: (name: FunnelEventName, count: number) => Promise<void>;
    };
};

const requestsTo = (method: HttpMethod, path: string): number =>
    fakeHttp.requests().filter((request) => request.method === method && request.path === path).length;

export const makeAppDriver = (): AppDriver => {
    let route = '/';
    respondToFunnelEvents();

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
            signupIsShown: (): void => {
                expect(screen.getByTestId(SignupTestIds.Page)).toBeInTheDocument();
            },
            visitorsCreated: (count: number): void => {
                expect(requestsTo(HttpMethod.Post, '/visitors')).toBe(count);
            },
            flagListsFetched: (count: number): void => {
                expect(requestsTo(HttpMethod.Get, '/feature-flags')).toBe(count);
            },
            stepsPosted: async (name: FunnelEventName, count: number): Promise<void> => {
                await waitFor(() => {
                    expect(postedSteps(name)).toHaveLength(count);
                });
            },
        },
    };
};
