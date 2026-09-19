import { act } from 'react';
import { expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { cleanup, screen, waitFor, within } from '@testing-library/react';

import { logger } from '~/logging/logger';
import { Dashboard } from '~/pages/Dashboard';
import { LiftCardTestIds } from '~/components/LiftCard.utils';
import { RESULT_SCREEN_TONE_FLAG } from '~/models/featureFlag';
import { ErrorStateTestIds } from '~/components/ErrorState.utils';
import type { ExperimentResultDTO } from '~/models/experimentResult';
import { HypothesisCardTestIds } from '~/components/HypothesisCard.utils';
import { DASHBOARD_ROUTE, DashboardTestIds } from '~/pages/Dashboard.utils';
import { FunnelBarsTestIds, funnelBarTestId } from '~/charts/FunnelBars.utils';
import { RenderMode, renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';
import { RecommendationBannerTestIds } from '~/components/RecommendationBanner.utils';

const RESULTS_PATH = `/experiments/${RESULT_SCREEN_TONE_FLAG}/results`;
const HTTP_SERVER_ERROR = 500;
const SERVER_ERROR_DETAIL = 'internal error';
const SHARE_PRECISION = 3;

export type DashboardDriver = {
    given: {
        theServerAnswers: (result: ExperimentResultDTO) => void;
        theServerFails: () => void;
        theAnswerNeverArrives: () => void;
    };
    when: {
        created: () => Promise<void>;
        createdInStrictMode: () => Promise<void>;
        unmounted: () => Promise<void>;
    };
    click: { retry: () => Promise<void> };
    assert: {
        hypothesisReads: (statement: string) => Promise<void>;
        funnelLegendLists: (...labels: string[]) => void;
        barReads: (bar: { series: string; step: string; share: number; value: number }) => void;
        liftReads: (value: string) => void;
        intervalReads: (line: string) => void;
        bannerReads: (text: string) => void;
        bannerIsClassed: (className: string) => void;
        sampleProgressReads: (progress: { reached: number; required: number }) => void;
        noSampleProgressIsShown: () => void;
        loadErrorIsShown: () => Promise<void>;
        loadFailureWasLogged: () => void;
        noLoadFailureWasLogged: () => void;
        resultsWereRequested: (times: number) => void;
        theFirstRequestWasAborted: () => void;
        theRequestInFlightWasAborted: () => void;
        exactlyOneFunnelIsRendered: () => void;
    };
};

export const makeDashboardDriver = (): DashboardDriver => {
    const user = userEvent.setup();
    const loggedErrors = vi.spyOn(logger, 'error').mockImplementation(() => {});

    const resultRequests = (): RecordedRequest[] =>
        fakeHttp.requests().filter((request) => request.method === HttpMethod.Get && request.path === RESULTS_PATH);

    const requestAt = (index: number): RecordedRequest => {
        const request = resultRequests().at(index);
        if (request === undefined) throw new Error(`DashboardDriver: no results request at index ${index}`);

        return request;
    };

    const render = async (mode: RenderMode): Promise<void> => {
        await act(async () => {
            renderWithProviders(<Dashboard />, { route: DASHBOARD_ROUTE, mode });
        });
    };

    return {
        given: {
            theServerAnswers: (result: ExperimentResultDTO): void => {
                fakeHttp.respond({ method: HttpMethod.Get, path: RESULTS_PATH, status: 200, body: result });
            },
            theServerFails: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: RESULTS_PATH,
                    status: HTTP_SERVER_ERROR,
                    body: { error: SERVER_ERROR_DETAIL },
                });
            },
            theAnswerNeverArrives: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: RESULTS_PATH,
                    status: 200,
                    body: {},
                    gate: new Promise<void>(() => {}),
                });
            },
        },
        when: {
            created: async (): Promise<void> => {
                await render(RenderMode.Plain);
            },
            createdInStrictMode: async (): Promise<void> => {
                await render(RenderMode.Strict);
            },
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
            hypothesisReads: async (statement: string): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(HypothesisCardTestIds.Statement)).toHaveTextContent(statement);
                });
            },
            funnelLegendLists: (...labels: string[]): void => {
                const legend = screen.getByTestId(FunnelBarsTestIds.Legend);
                for (const label of labels) {
                    expect(within(legend).getByText(label)).toBeInTheDocument();
                }
            },
            barReads: ({ series, step, share, value }): void => {
                const bar = screen.getByTestId(funnelBarTestId({ series, step }));
                expect(Number(bar.getAttribute('value'))).toBeCloseTo(share, SHARE_PRECISION);
                expect(bar).toHaveAccessibleName(expect.stringContaining(value.toLocaleString('en-US')));
            },
            liftReads: (value: string): void => {
                expect(screen.getByTestId(LiftCardTestIds.Value)).toHaveTextContent(value);
            },
            intervalReads: (line: string): void => {
                expect(screen.getByTestId(LiftCardTestIds.Interval)).toHaveTextContent(line);
            },
            bannerReads: (text: string): void => {
                expect(screen.getByTestId(RecommendationBannerTestIds.Root)).toHaveTextContent(text);
            },
            bannerIsClassed: (className: string): void => {
                expect(screen.getByTestId(RecommendationBannerTestIds.Root)).toHaveClass(className);
            },
            sampleProgressReads: ({ reached, required }): void => {
                const progress = screen.getByTestId(RecommendationBannerTestIds.Progress);
                expect(progress).toHaveAttribute('value', String(reached));
                expect(progress).toHaveAttribute('max', String(required));
            },
            noSampleProgressIsShown: (): void => {
                expect(screen.queryByTestId(RecommendationBannerTestIds.Progress)).not.toBeInTheDocument();
            },
            loadErrorIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(ErrorStateTestIds.Root)).toBeInTheDocument();
                });
                expect(screen.getByTestId(DashboardTestIds.Page)).not.toHaveTextContent(SERVER_ERROR_DETAIL);
            },
            loadFailureWasLogged: (): void => {
                expect(loggedErrors).toHaveBeenCalledWith(
                    expect.stringContaining('Dashboard'),
                    expect.objectContaining({ detail: SERVER_ERROR_DETAIL }),
                );
            },
            noLoadFailureWasLogged: (): void => {
                expect(loggedErrors).not.toHaveBeenCalled();
            },
            resultsWereRequested: (times: number): void => {
                expect(resultRequests()).toHaveLength(times);
            },
            theFirstRequestWasAborted: (): void => {
                expect(requestAt(0).isAborted()).toBe(true);
            },
            theRequestInFlightWasAborted: (): void => {
                expect(requestAt(-1).isAborted()).toBe(true);
            },
            exactlyOneFunnelIsRendered: (): void => {
                expect(screen.getAllByTestId(FunnelBarsTestIds.Root)).toHaveLength(1);
            },
        },
    };
};
