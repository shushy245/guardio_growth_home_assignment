import { act } from 'react';
import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { App } from '~/App';
import { AdminTestIds } from '~/pages/Admin.utils';
import { LandingTestIds } from '~/pages/Landing.utils';
import { FunnelEventName } from '~/models/funnelEvent';
import { isPlainObject } from '~/api/http-client.utils';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';

const EVENTS_PATH = '/funnel-events';

export type AppDriver = {
    given: { route: (path: string) => void };
    when: { created: () => Promise<void> };
    assert: {
        landingIsShown: () => void;
        adminIsShown: () => void;
        visitorsCreated: (count: number) => void;
        flagListsFetched: (count: number) => void;
        stepsPosted: (name: FunnelEventName, count: number) => Promise<void>;
    };
};

const requestsTo = (method: HttpMethod, path: string): number =>
    fakeHttp.requests().filter((request) => request.method === method && request.path === path).length;

const nameOf = (request: RecordedRequest): unknown => (isPlainObject(request.body) ? request.body['name'] : undefined);

const postsNamed = (name: FunnelEventName): RecordedRequest[] =>
    fakeHttp
        .requests()
        .filter((request) => request.method === HttpMethod.Post && request.path === EVENTS_PATH)
        .filter((request) => nameOf(request) === name);

export const makeAppDriver = (): AppDriver => {
    let route = '/';
    fakeHttp.respond({ method: HttpMethod.Post, path: EVENTS_PATH, status: 201, body: {} });

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
            stepsPosted: async (name: FunnelEventName, count: number): Promise<void> => {
                await waitFor(() => {
                    expect(postsNamed(name)).toHaveLength(count);
                });
            },
        },
    };
};
