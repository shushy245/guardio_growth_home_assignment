import { act } from 'react';
import { expect } from 'vitest';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import { Landing } from '~/pages/Landing';
import { LandingTestIds } from '~/pages/Landing.utils';
import { FunnelEventName } from '~/models/funnelEvent';
import { isPlainObject } from '~/api/http-client.utils';
import { FunnelProviders } from '~/providers/FunnelProviders';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';

const EVENTS_PATH = '/funnel-events';

// Where the scan button leads. A probe route rather than the real Scan page: this driver proves
// the landing page navigates, and the Scan page's own driver proves what happens there.
export enum LandingProbeTestIds {
    ScanRoute = 'LandingProbeTestIds.ScanRoute',
}

const ScanRouteProbe = (): ReactElement => <span data-testid={LandingProbeTestIds.ScanRoute}>{`scan`}</span>;

export type LandingDriver = {
    when: { created: () => Promise<void> };
    click: { scan: () => Promise<void> };
    assert: {
        scanButtonIsShown: () => void;
        stepsPosted: (name: FunnelEventName, count: number) => Promise<void>;
        scanRouteIsShown: () => Promise<void>;
    };
};

export const makeLandingDriver = (): LandingDriver => {
    const user = userEvent.setup();
    fakeHttp.respond({ method: HttpMethod.Post, path: EVENTS_PATH, status: 201, body: {} });

    const nameOf = (request: RecordedRequest): unknown =>
        isPlainObject(request.body) ? request.body['name'] : undefined;

    const postsNamed = (name: FunnelEventName): RecordedRequest[] =>
        fakeHttp
            .requests()
            .filter((request) => request.method === HttpMethod.Post && request.path === EVENTS_PATH)
            .filter((request) => nameOf(request) === name);

    return {
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <FunnelProviders>
                            <Routes>
                                <Route path="/" element={<Landing />} />
                                <Route path="/scan" element={<ScanRouteProbe />} />
                            </Routes>
                        </FunnelProviders>,
                        { route: '/' },
                    );
                });
            },
        },
        click: {
            scan: async (): Promise<void> => {
                await user.click(screen.getByTestId(LandingTestIds.Scan));
            },
        },
        assert: {
            scanButtonIsShown: (): void => {
                expect(screen.getByTestId(LandingTestIds.Scan)).toBeEnabled();
            },
            stepsPosted: async (name: FunnelEventName, count: number): Promise<void> => {
                await waitFor(() => {
                    expect(postsNamed(name)).toHaveLength(count);
                });
            },
            scanRouteIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(LandingProbeTestIds.ScanRoute)).toBeInTheDocument();
                });
            },
        },
    };
};
