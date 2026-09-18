import { act } from 'react';
import { expect } from 'vitest';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import { Result } from '~/pages/Result';
import { Tone } from '~/models/featureFlag';
import type { VisitorDTO } from '~/models/visitor';
import { FunnelEventName } from '~/models/funnelEvent';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { FunnelProviders } from '~/providers/FunnelProviders';
import { ResultTestIds, toneClassMap } from '~/pages/Result.utils';
import { aBreachDTO, aBreachSummaryDTO } from '~/testkit/builders';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { postedSteps, respondToFunnelEvents } from '~/testkit/funnel-events';

const SUMMARY_PATH = '/breaches/summary';
const LIST_PATH = '/breaches';
const HTTP_SERVER_ERROR = 500;

// Where the CTA leads. A probe route rather than the real Signup page: this driver proves the
// result page hands the visitor on, and S6's driver proves what is there.
export enum ResultProbeTestIds {
    SignupRoute = 'ResultProbeTestIds.SignupRoute',
}

const SignupRouteProbe = (): ReactElement => <span data-testid={ResultProbeTestIds.SignupRoute}>{`signup`}</span>;

export type ResultDriver = {
    given: {
        theVisitorIsAssigned: (visitor: VisitorDTO) => void;
        theVisitorSessionFails: () => void;
    };
    when: { created: () => Promise<void> };
    click: { cta: () => Promise<void> };
    assert: {
        headlineReads: (headline: string) => Promise<void>;
        subheadlineReads: (subheadline: string) => Promise<void>;
        ctaReads: (label: string) => Promise<void>;
        toneIs: (tone: Tone) => Promise<void>;
        ctaCount: (count: number) => void;
        ctaIsInTheStickyBar: () => void;
        stepsPosted: (name: FunnelEventName, count: number) => Promise<void>;
        signupRouteIsShown: () => Promise<void>;
    };
};

export const makeResultDriver = (): ResultDriver => {
    const user = userEvent.setup();

    respondToFunnelEvents();
    fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: aBreachSummaryDTO().build() });
    fakeHttp.respond({
        method: HttpMethod.Get,
        path: LIST_PATH,
        status: 200,
        body: { items: [aBreachDTO().build()], total: 1, page: 1, limit: 20 },
    });

    const cta = (): HTMLElement => screen.getByTestId(ResultTestIds.Cta);

    return {
        given: {
            theVisitorIsAssigned: (visitor: VisitorDTO): void => {
                fakeHttp.respond({ method: HttpMethod.Post, path: '/visitors', status: 201, body: visitor });
            },
            theVisitorSessionFails: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Post,
                    path: '/visitors',
                    status: HTTP_SERVER_ERROR,
                    body: { error: 'internal error' },
                });
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <FunnelProviders>
                            <Routes>
                                <Route path="/result" element={<Result />} />
                                <Route path="/signup" element={<SignupRouteProbe />} />
                            </Routes>
                        </FunnelProviders>,
                        { route: '/result' },
                    );
                });
            },
        },
        click: {
            cta: async (): Promise<void> => {
                await user.click(cta());
            },
        },
        assert: {
            headlineReads: async (headline: string): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(ResultTestIds.Headline)).toHaveTextContent(headline);
                });
            },
            subheadlineReads: async (subheadline: string): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(ResultTestIds.Subheadline)).toHaveTextContent(subheadline);
                });
            },
            ctaReads: async (label: string): Promise<void> => {
                await waitFor(() => {
                    expect(cta()).toHaveTextContent(label);
                });
            },
            // The tone seam's client half: the root carries the class whose custom properties
            // every button and chip beneath it reads. The colour it resolves to is measured in
            // the visual pass, not here — jsdom computes no stylesheet.
            toneIs: async (tone: Tone): Promise<void> => {
                const toneClass = toneClassMap[tone];
                if (toneClass === undefined) throw new Error(`ResultDriver: no class for tone ${tone}`);
                await waitFor(() => {
                    expect(screen.getByTestId(ResultTestIds.Page)).toHaveClass(toneClass);
                });
            },
            ctaCount: (count: number): void => {
                expect(screen.queryAllByTestId(ResultTestIds.Cta)).toHaveLength(count);
            },
            ctaIsInTheStickyBar: (): void => {
                expect(screen.getByTestId(ResultTestIds.StickyBar)).toContainElement(cta());
            },
            stepsPosted: async (name: FunnelEventName, count: number): Promise<void> => {
                await waitFor(() => {
                    expect(postedSteps(name)).toHaveLength(count);
                });
            },
            signupRouteIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(ResultProbeTestIds.SignupRoute)).toBeInTheDocument();
                });
            },
        },
    };
};
