import { expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { act, type ReactElement, useState } from 'react';

import { logger } from '~/logging/logger';
import { aVisitorDTO } from '~/testkit/builders';
import type { VisitorDTO } from '~/models/visitor';
import { useTrackOnce } from '~/hooks/useTrackOnce';
import { FunnelEventName } from '~/models/funnelEvent';
import { isPlainObject } from '~/api/http-client.utils';
import { isReady } from '~/providers/VisitorProvider.utils';
import type { FunnelEventCreateDTO } from '~/models/funnelEvent';
import { useVisitor, VisitorProvider } from '~/providers/VisitorProvider';
import { RenderMode, renderWithProviders } from '~/testkit/renderWithProviders';
import { AnalyticsProvider, useAnalytics } from '~/providers/AnalyticsProvider';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';

// A test-only consumer: the two ways a page records a step — on mount, and on an interaction.
export enum AnalyticsProbeTestIds {
    TrackScanStarted = 'AnalyticsProbeTestIds.TrackScanStarted',
    ShowTheStepAgain = 'AnalyticsProbeTestIds.ShowTheStepAgain',
}

const EVENTS_PATH = '/funnel-events';
const HTTP_SERVER_ERROR = 500;
const A_MINUTE_MS = 60_000;

const MountedStep = ({ name }: { name: FunnelEventName }): ReactElement => {
    useTrackOnce(name);

    return <span>{name}</span>;
};

// A step that exists only once the visitor is known — what a page gated on the session does.
// Its mount effect runs in the same commit that turns the session ready, before the provider's
// own effect, which is the interleaving F6 pins down.
const StepShownOnceReady = ({ name }: { name: FunnelEventName }): ReactElement | undefined => {
    const visitor = useVisitor();
    if (!isReady(visitor)) return undefined;

    return <MountedStep name={name} />;
};

const AnalyticsProbe = ({ readyOnlyStep }: { readyOnlyStep: FunnelEventName | undefined }): ReactElement => {
    const { track } = useAnalytics();
    const [stepMount, setStepMount] = useState(0);

    const handleTrackScanStarted = (): void => {
        track(FunnelEventName.ScanStarted);
    };
    const handleShowTheStepAgain = (): void => {
        setStepMount((count) => count + 1);
    };

    return (
        <div>
            <MountedStep key={stepMount} name={FunnelEventName.LandingView} />
            {readyOnlyStep === undefined ? undefined : <StepShownOnceReady name={readyOnlyStep} />}
            <button type="button" data-testid={AnalyticsProbeTestIds.TrackScanStarted} onClick={handleTrackScanStarted}>
                {`track`}
            </button>
            <button type="button" data-testid={AnalyticsProbeTestIds.ShowTheStepAgain} onClick={handleShowTheStepAgain}>
                {`again`}
            </button>
        </div>
    );
};

export type AnalyticsProviderDriver = {
    given: {
        theServerCreates: (visitor: VisitorDTO) => void;
        theVisitorIsSlowToArrive: () => void;
        theVisitorCannotBeCreated: () => void;
        theServerRejectsEvents: () => void;
        aStepShownOnceTheVisitorIsReady: (name: FunnelEventName) => void;
        strictMode: () => void;
    };
    when: {
        created: () => Promise<void>;
        theVisitorArrives: () => Promise<void>;
    };
    click: {
        trackScanStarted: () => Promise<void>;
        showTheStepAgain: () => Promise<void>;
    };
    assert: {
        eventsPosted: (count: number) => Promise<void>;
        postedEventIsWellFormed: (expected: { name: FunnelEventName }) => Promise<void>;
        postedEventNamesInOrder: (names: FunnelEventName[]) => Promise<void>;
        postedEventIdsAreDistinct: () => void;
        failureWasLogged: () => Promise<void>;
        droppedEventsWereLogged: (count: number) => Promise<void>;
    };
};

export const makeAnalyticsProviderDriver = (): AnalyticsProviderDriver => {
    const user = userEvent.setup();
    let mode = RenderMode.Plain;
    let readyOnlyStep: FunnelEventName | undefined = undefined;
    let releaseVisitor: (() => void) | undefined = undefined;
    const loggedErrors = vi.spyOn(logger, 'error').mockImplementation(() => {});

    // The default world: the server accepts every event. A scenario overrides it.
    fakeHttp.respond({ method: HttpMethod.Post, path: EVENTS_PATH, status: 201, body: {} });

    const posts = (): RecordedRequest[] =>
        fakeHttp.requests().filter((request) => request.method === HttpMethod.Post && request.path === EVENTS_PATH);

    // A type predicate, not a cast: the recorded body arrives as `unknown` and this is the one
    // place that says what an event looks like on the wire.
    const isEventPayload = (body: unknown): body is FunnelEventCreateDTO =>
        isPlainObject(body) &&
        typeof body['id'] === 'string' &&
        typeof body['name'] === 'string' &&
        typeof body['occurredAt'] === 'string';

    const payloadOf = (request: RecordedRequest): FunnelEventCreateDTO => {
        if (!isEventPayload(request.body)) {
            throw new Error(`AnalyticsProviderDriver: not an event body — ${JSON.stringify(request.body)}`);
        }

        return request.body;
    };

    const postedPayloads = (): FunnelEventCreateDTO[] => posts().map(payloadOf);

    const theOnlyPayload = (): FunnelEventCreateDTO => {
        const [payload, ...rest] = postedPayloads();
        if (payload === undefined || rest.length > 0) {
            throw new Error(`AnalyticsProviderDriver: expected exactly one event, got ${postedPayloads().length}`);
        }

        return payload;
    };

    return {
        given: {
            theServerCreates: (visitor: VisitorDTO): void => {
                fakeHttp.respond({ method: HttpMethod.Post, path: '/visitors', status: 201, body: visitor });
            },
            theVisitorIsSlowToArrive: (): void => {
                const gate = new Promise<void>((resolve) => {
                    releaseVisitor = resolve;
                });
                fakeHttp.respond({
                    method: HttpMethod.Post,
                    path: '/visitors',
                    status: 201,
                    body: aVisitorDTO().build(),
                    gate,
                });
            },
            theVisitorCannotBeCreated: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Post,
                    path: '/visitors',
                    status: HTTP_SERVER_ERROR,
                    body: { error: 'internal error' },
                });
            },
            theServerRejectsEvents: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Post,
                    path: EVENTS_PATH,
                    status: HTTP_SERVER_ERROR,
                    body: { error: 'internal error' },
                });
            },
            aStepShownOnceTheVisitorIsReady: (name: FunnelEventName): void => {
                readyOnlyStep = name;
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
                            <AnalyticsProvider>
                                <AnalyticsProbe readyOnlyStep={readyOnlyStep} />
                            </AnalyticsProvider>
                        </VisitorProvider>,
                        { route: '/', mode },
                    );
                });
            },
            theVisitorArrives: async (): Promise<void> => {
                if (releaseVisitor === undefined) {
                    throw new Error('AnalyticsProviderDriver: given.theVisitorIsSlowToArrive() first');
                }
                const release = releaseVisitor;
                await act(async () => {
                    release();
                });
            },
        },
        click: {
            trackScanStarted: async (): Promise<void> => {
                await user.click(screen.getByTestId(AnalyticsProbeTestIds.TrackScanStarted));
            },
            showTheStepAgain: async (): Promise<void> => {
                await user.click(screen.getByTestId(AnalyticsProbeTestIds.ShowTheStepAgain));
            },
        },
        assert: {
            eventsPosted: async (count: number): Promise<void> => {
                await waitFor(() => {
                    expect(posts()).toHaveLength(count);
                });
            },
            postedEventIsWellFormed: async ({ name }): Promise<void> => {
                await waitFor(() => {
                    expect(posts()).toHaveLength(1);
                });
                const payload = theOnlyPayload();
                expect(payload).toMatchObject({ name });
                // The identity is the cookie the browser carries, never a field a page could set.
                expect(payload).not.toHaveProperty('visitorId');
                expect(payload.id).toMatch(/^evt_/);
                expect(Date.now() - new Date(payload.occurredAt).getTime()).toBeLessThan(A_MINUTE_MS);
            },
            postedEventNamesInOrder: async (names: FunnelEventName[]): Promise<void> => {
                await waitFor(() => {
                    expect(postedPayloads().map((payload) => payload.name)).toStrictEqual(names);
                });
            },
            postedEventIdsAreDistinct: (): void => {
                const ids = postedPayloads().map((payload) => payload.id);
                expect(new Set(ids).size).toBe(ids.length);
            },
            failureWasLogged: async (): Promise<void> => {
                await waitFor(() => {
                    expect(loggedErrors).toHaveBeenCalledWith(
                        expect.stringContaining('could not be recorded'),
                        expect.objectContaining({ name: FunnelEventName.LandingView, detail: 'internal error' }),
                    );
                });
            },
            droppedEventsWereLogged: async (count: number): Promise<void> => {
                await waitFor(() => {
                    expect(loggedErrors).toHaveBeenCalledWith(
                        expect.stringContaining('dropping'),
                        expect.objectContaining({ count }),
                    );
                });
            },
        },
    };
};
