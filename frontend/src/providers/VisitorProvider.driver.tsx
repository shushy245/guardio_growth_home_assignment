import { expect } from 'vitest';
import { act, type ReactElement } from 'react';
import { screen, waitFor } from '@testing-library/react';

import type { VisitorDTO } from '~/models/visitor';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import type { FeatureFlagDTO } from '~/models/featureFlag';
import { useVisitor, VisitorProvider } from '~/providers/VisitorProvider';
import { readStoredVisitorId, storeVisitorId } from '~/storage/visitor-id';
import { RenderMode, renderWithProviders } from '~/testkit/renderWithProviders';
import { isFailed, variantFor, VisitorStatus } from '~/providers/VisitorProvider.utils';

// A test-only consumer: renders what a page would read from the provider, and nothing else.
export enum VisitorProbeTestIds {
    Status = 'VisitorProbeTestIds.Status',
    Headline = 'VisitorProbeTestIds.Headline',
    Error = 'VisitorProbeTestIds.Error',
}

const RESULT_SCREEN_TONE = 'result_screen_tone';
const HTTP_NOT_FOUND = 404;
const HTTP_SERVER_ERROR = 500;

const VisitorProbe = (): ReactElement => {
    const state = useVisitor();
    const variant = variantFor(state, RESULT_SCREEN_TONE);

    return (
        <div>
            <span data-testid={VisitorProbeTestIds.Status}>{state.status}</span>
            {variant === undefined ? undefined : (
                <span data-testid={VisitorProbeTestIds.Headline}>{variant.config.headline}</span>
            )}
            {isFailed(state) ? <span data-testid={VisitorProbeTestIds.Error}>{state.error}</span> : undefined}
        </div>
    );
};

export type VisitorProviderDriver = {
    given: {
        storedVisitorId: (id: string) => void;
        theServerCreates: (visitor: VisitorDTO) => void;
        theServerKnowsVisitor: (visitor: VisitorDTO) => void;
        theServerHasForgottenVisitor: (id: string) => void;
        visitorCreationFails: () => void;
        theServerListsFlags: (...flags: FeatureFlagDTO[]) => void;
        strictMode: () => void;
    };
    when: { created: () => Promise<void> };
    assert: {
        headlineIsShown: (headline: string) => Promise<void>;
        sessionFailedWith: (error: string) => Promise<void>;
        noHeadlineIsShown: () => void;
        visitorsCreated: (count: number) => void;
        visitorWasFetched: (id: string) => void;
        storedVisitorIdIs: (id: string) => void;
    };
};

export const makeVisitorProviderDriver = (): VisitorProviderDriver => {
    let mode = RenderMode.Plain;

    const requestsTo = (method: HttpMethod, path: string): number =>
        fakeHttp.requests().filter((request) => request.method === method && request.path === path).length;

    return {
        given: {
            storedVisitorId: (id: string): void => {
                storeVisitorId(id);
            },
            theServerCreates: (visitor: VisitorDTO): void => {
                fakeHttp.respond({ method: HttpMethod.Post, path: '/visitors', status: 201, body: visitor });
            },
            theServerKnowsVisitor: (visitor: VisitorDTO): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: `/visitors/${visitor.id}`,
                    status: 200,
                    body: visitor,
                });
            },
            theServerHasForgottenVisitor: (id: string): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: `/visitors/${id}`,
                    status: HTTP_NOT_FOUND,
                    body: { error: `get_visitor: no visitor with id '${id}'` },
                });
            },
            visitorCreationFails: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Post,
                    path: '/visitors',
                    status: HTTP_SERVER_ERROR,
                    body: { error: 'internal error' },
                });
            },
            theServerListsFlags: (...flags: FeatureFlagDTO[]): void => {
                fakeHttp.respond({ method: HttpMethod.Get, path: '/feature-flags', status: 200, body: flags });
            },
            strictMode: (): void => {
                mode = RenderMode.Strict;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <VisitorProvider>
                            <VisitorProbe />
                        </VisitorProvider>,
                        { route: '/', mode },
                    );
                });
            },
        },
        assert: {
            headlineIsShown: async (headline: string): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(VisitorProbeTestIds.Headline)).toHaveTextContent(headline);
                });
            },
            sessionFailedWith: async (error: string): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(VisitorProbeTestIds.Status)).toHaveTextContent(VisitorStatus.Failed);
                });
                expect(screen.getByTestId(VisitorProbeTestIds.Error)).toHaveTextContent(error);
            },
            noHeadlineIsShown: (): void => {
                expect(screen.queryByTestId(VisitorProbeTestIds.Headline)).not.toBeInTheDocument();
            },
            visitorsCreated: (count: number): void => {
                expect(requestsTo(HttpMethod.Post, '/visitors')).toBe(count);
            },
            visitorWasFetched: (id: string): void => {
                expect(requestsTo(HttpMethod.Get, `/visitors/${id}`)).toBe(1);
            },
            storedVisitorIdIs: (id: string): void => {
                expect(readStoredVisitorId()).toBe(id);
            },
        },
    };
};
