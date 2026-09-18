import { act } from 'react';
import { expect, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';

import { Tone } from '~/models/featureFlag';
import { aBreachSummaryDTO } from '~/testkit/builders';
import { aMediaQueryList } from '~/testkit/media-query';
import type { BreachSummaryDTO } from '~/models/breach';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { BreachSummary } from '~/components/BreachSummary';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { BreachCatalogProvider } from '~/providers/BreachCatalogProvider';
import { BreachSummaryTestIds, SummaryTile, summaryTileTestId } from '~/components/BreachSummary.utils';

const SUMMARY_PATH = '/breaches/summary';
const LIST_PATH = '/breaches';

export type BreachSummaryDriver = {
    given: {
        theSummary: (summary: BreachSummaryDTO) => void;
        theSummaryIsSlowToArrive: () => void;
        theTone: (tone: Tone) => void;
        theVisitorPrefersReducedMotion: () => void;
        theClockReads: (now: Date) => void;
    };
    when: {
        created: () => Promise<void>;
        theSummaryArrives: () => Promise<void>;
        framesPass: (count: number) => Promise<void>;
        unmounted: () => Promise<void>;
    };
    assert: {
        tileReads: (tile: SummaryTile, value: string) => Promise<void>;
        tileSupportReads: (tile: SummaryTile, support: string) => Promise<void>;
        skeletonTilesAreShown: () => void;
        tilesAreShown: () => Promise<void>;
        tileReadsLessThan: (tile: SummaryTile, value: string) => void;
        nothingIsStillScheduled: () => void;
        syncedLineReads: (text: string) => Promise<void>;
    };
};

// One frame of the count-up, in the clock it runs on.
const FRAME_MS = 16;

export const makeBreachSummaryDriver = (): BreachSummaryDriver => {
    let releaseSummary: (() => void) | undefined = undefined;
    let tone = Tone.Calm;
    let reducedMotion = false;
    // Only the frame clock: promises and the fake network stay real, so testing-library's
    // `waitFor` (which drains through `setTimeout`) keeps working.
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'Date'] });

    fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: aBreachSummaryDTO().build() });
    fakeHttp.respond({
        method: HttpMethod.Get,
        path: LIST_PATH,
        status: 200,
        body: { items: [], total: 0, page: 1, limit: 20 },
    });

    const tile = (id: SummaryTile): HTMLElement => screen.getByTestId(summaryTileTestId(id));

    return {
        given: {
            theSummary: (summary: BreachSummaryDTO): void => {
                fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: summary });
            },
            theTone: (chosen: Tone): void => {
                tone = chosen;
            },
            theVisitorPrefersReducedMotion: (): void => {
                reducedMotion = true;
            },
            theClockReads: (now: Date): void => {
                vi.setSystemTime(now);
            },
            theSummaryIsSlowToArrive: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: SUMMARY_PATH,
                    status: 200,
                    body: aBreachSummaryDTO().build(),
                    gate: new Promise<void>((resolve) => {
                        releaseSummary = resolve;
                    }),
                });
            },
        },
        when: {
            created: async (): Promise<void> => {
                window.matchMedia = (media: string): MediaQueryList =>
                    aMediaQueryList({ media, matches: reducedMotion && media.includes('prefers-reduced-motion') });
                await act(async () => {
                    renderWithProviders(
                        <BreachCatalogProvider>
                            <BreachSummary tone={tone} />
                        </BreachCatalogProvider>,
                    );
                });
            },
            framesPass: async (count: number): Promise<void> => {
                await act(async () => {
                    vi.advanceTimersByTime(count * FRAME_MS);
                });
            },
            unmounted: async (): Promise<void> => {
                await act(async () => {
                    cleanup();
                });
            },
            theSummaryArrives: async (): Promise<void> => {
                const release = releaseSummary;
                if (release === undefined) throw new Error('BreachSummaryDriver: the summary is not waiting');
                await act(async () => {
                    release();
                });
            },
        },
        assert: {
            tileReads: async (id: SummaryTile, value: string): Promise<void> => {
                await waitFor(() => {
                    expect(tile(id)).toHaveTextContent(value);
                });
            },
            tileSupportReads: async (id: SummaryTile, support: string): Promise<void> => {
                await waitFor(() => {
                    expect(tile(id)).toHaveTextContent(support);
                });
            },
            skeletonTilesAreShown: (): void => {
                expect(screen.getByTestId(BreachSummaryTestIds.Skeleton)).toBeInTheDocument();
            },
            tilesAreShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(BreachSummaryTestIds.Tiles)).toBeInTheDocument();
                });
                expect(screen.queryByTestId(BreachSummaryTestIds.Skeleton)).not.toBeInTheDocument();
            },
            // Mid-count: the tile shows a number, and not yet the final one.
            tileReadsLessThan: (id: SummaryTile, value: string): void => {
                expect(tile(id)).not.toHaveTextContent(value);
                expect(tile(id)).toHaveTextContent(/\d/);
            },
            nothingIsStillScheduled: (): void => {
                expect(vi.getTimerCount()).toBe(0);
            },
            syncedLineReads: async (text: string): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(BreachSummaryTestIds.Synced)).toHaveTextContent(text);
                });
            },
        },
    };
};
