import { act } from 'react';
import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { App } from '~/App';
import { Plan } from '~/models/signup';
import { AdminTestIds } from '~/pages/Admin.utils';
import { SignupTestIds } from '~/pages/Signup.utils';
import { LandingTestIds } from '~/pages/Landing.utils';
import { FunnelEventName } from '~/models/funnelEvent';
import { NotFoundTestIds } from '~/pages/NotFound.utils';
import { ProtectedTestIds } from '~/pages/Protected.utils';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { postedSteps, respondToFunnelEvents } from '~/testkit/funnel-events';
import { RenderMode, renderWithProviders } from '~/testkit/renderWithProviders';

export type AppDriver = {
    given: { route: (path: string, state?: unknown) => void };
    when: { created: () => Promise<void> };
    assert: {
        landingIsShown: () => void;
        adminIsShown: () => void;
        signupIsShown: () => void;
        protectedIsShown: () => void;
        notFoundIsShown: () => void;
        visitorsCreated: (count: number) => void;
        flagListsFetched: (count: number) => void;
        stepsPosted: (name: FunnelEventName, count: number) => Promise<void>;
        noStepPosted: (name: FunnelEventName) => void;
    };
};

const requestsTo = (method: HttpMethod, path: string): number =>
    fakeHttp.requests().filter((request) => request.method === method && request.path === path).length;

// The state a sign-up leaves on the confirmation route.
export const A_SIGNUP_STATE = { plan: Plan.Family };

export const makeAppDriver = (): AppDriver => {
    let route = '/';
    let state: unknown = undefined;
    respondToFunnelEvents();

    return {
        given: {
            route: (path: string, carried?: unknown): void => {
                route = path;
                state = carried;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    // Strict, because `main.tsx` ships StrictMode: an effect that fires twice on
                    // mount is what production's development build actually does, and a driver
                    // rendering plain certifies as single what is double there (BF58).
                    renderWithProviders(<App />, { route, state, mode: RenderMode.Strict });
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
            protectedIsShown: (): void => {
                expect(screen.getByTestId(ProtectedTestIds.Page)).toBeInTheDocument();
            },
            notFoundIsShown: (): void => {
                expect(screen.getByTestId(NotFoundTestIds.Page)).toBeInTheDocument();
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
            // Synchronous on purpose: an absence inside `waitFor` is true on its first look and
            // proves nothing. `when.created()` settled the tree inside `act`, so a step that was
            // going to be posted has been.
            noStepPosted: (name: FunnelEventName): void => {
                expect(postedSteps(name)).toHaveLength(0);
            },
        },
    };
};
