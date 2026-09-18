import { act } from 'react';
import { expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { cleanup, screen } from '@testing-library/react';

import { Scan } from '~/pages/Scan';
import { FunnelEventName } from '~/models/funnelEvent';
import { isPlainObject } from '~/api/http-client.utils';
import { FunnelProviders } from '~/providers/FunnelProviders';
import { SCAN_MOMENT_MS, ScanTestIds } from '~/pages/Scan.utils';
import { ErrorStateTestIds } from '~/components/ErrorState.utils';
import { aBreachDTO, aBreachSummaryDTO } from '~/testkit/builders';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';

const EVENTS_PATH = '/funnel-events';
const SUMMARY_PATH = '/breaches/summary';
const LIST_PATH = '/breaches';
const HTTP_SERVICE_UNAVAILABLE = 503;

// Where the scan moment leads. A probe route rather than the real Result page: this driver
// proves the moment ends in a navigation, and the Result page's own driver proves what is there.
export enum ScanProbeTestIds {
    ResultRoute = 'ScanProbeTestIds.ResultRoute',
}

const ResultRouteProbe = (): ReactElement => <span data-testid={ScanProbeTestIds.ResultRoute}>{`result`}</span>;

export type ScanDriver = {
    given: {
        theCatalogIsSlowToArrive: () => void;
        theCatalogCannotBeReached: () => void;
    };
    when: {
        created: () => Promise<void>;
        theCatalogArrives: () => Promise<void>;
        theMomentPasses: () => Promise<void>;
        unmounted: () => Promise<void>;
    };
    click: { retry: () => Promise<void> };
    assert: {
        scanningIsShown: () => void;
        resultRouteIsShown: () => void;
        resultRouteIsNotShown: () => void;
        errorIsShown: () => void;
        stepsPosted: (name: FunnelEventName, count: number) => void;
        catalogRequested: (times: number) => void;
    };
};

export const makeScanDriver = (): ScanDriver => {
    // Only the clock the moment reads: promises and the fake network stay real, so a gated
    // route is released with `act` and the two seconds pass with `advanceTimersByTime`.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    let releaseCatalog: (() => void) | undefined = undefined;

    fakeHttp.respond({ method: HttpMethod.Post, path: EVENTS_PATH, status: 201, body: {} });
    fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: aBreachSummaryDTO().build() });
    fakeHttp.respond({
        method: HttpMethod.Get,
        path: LIST_PATH,
        status: 200,
        body: { items: [aBreachDTO().build()], total: 1, page: 1, limit: 20 },
    });

    const nameOf = (request: RecordedRequest): unknown =>
        isPlainObject(request.body) ? request.body['name'] : undefined;

    const postsNamed = (name: FunnelEventName): RecordedRequest[] =>
        fakeHttp
            .requests()
            .filter((request) => request.method === HttpMethod.Post && request.path === EVENTS_PATH)
            .filter((request) => nameOf(request) === name);

    const catalogRequests = (): RecordedRequest[] =>
        fakeHttp.requests().filter((request) => request.method === HttpMethod.Get && request.path === SUMMARY_PATH);

    return {
        given: {
            theCatalogIsSlowToArrive: (): void => {
                const gate = new Promise<void>((resolve) => {
                    releaseCatalog = resolve;
                });
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: SUMMARY_PATH,
                    status: 200,
                    body: aBreachSummaryDTO().build(),
                    gate,
                });
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: LIST_PATH,
                    status: 200,
                    body: { items: [aBreachDTO().build()], total: 1, page: 1, limit: 20 },
                    gate,
                });
            },
            theCatalogCannotBeReached: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: SUMMARY_PATH,
                    status: HTTP_SERVICE_UNAVAILABLE,
                    body: { error: 'the catalog is empty' },
                });
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: LIST_PATH,
                    status: HTTP_SERVICE_UNAVAILABLE,
                    body: { error: 'the catalog is empty' },
                });
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <FunnelProviders>
                            <Routes>
                                <Route path="/scan" element={<Scan />} />
                                <Route path="/result" element={<ResultRouteProbe />} />
                            </Routes>
                        </FunnelProviders>,
                        { route: '/scan' },
                    );
                });
            },
            theCatalogArrives: async (): Promise<void> => {
                const release = releaseCatalog;
                if (release === undefined) throw new Error('ScanDriver: the catalog is not waiting to be released');
                await act(async () => {
                    release();
                });
            },
            theMomentPasses: async (): Promise<void> => {
                await act(async () => {
                    vi.advanceTimersByTime(SCAN_MOMENT_MS);
                });
            },
            // The visitor leaves the funnel mid-scan: the back button, a closed tab.
            unmounted: async (): Promise<void> => {
                await act(async () => {
                    cleanup();
                });
            },
        },
        click: {
            retry: async (): Promise<void> => {
                await user.click(screen.getByTestId(ErrorStateTestIds.Retry));
            },
        },
        assert: {
            scanningIsShown: (): void => {
                expect(screen.getByTestId(ScanTestIds.Scanning)).toBeInTheDocument();
            },
            // Synchronous on purpose: every `when` above settles the tree inside `act`, and
            // testing-library's `waitFor` drains through a `setTimeout` this driver has faked.
            resultRouteIsShown: (): void => {
                expect(screen.getByTestId(ScanProbeTestIds.ResultRoute)).toBeInTheDocument();
            },
            resultRouteIsNotShown: (): void => {
                expect(screen.queryByTestId(ScanProbeTestIds.ResultRoute)).not.toBeInTheDocument();
            },
            errorIsShown: (): void => {
                expect(screen.getByTestId(ErrorStateTestIds.Retry)).toBeInTheDocument();
            },
            stepsPosted: (name: FunnelEventName, count: number): void => {
                expect(postsNamed(name)).toHaveLength(count);
            },
            catalogRequested: (times: number): void => {
                expect(catalogRequests()).toHaveLength(times);
            },
        },
    };
};
