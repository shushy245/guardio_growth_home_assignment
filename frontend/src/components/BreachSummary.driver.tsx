import { act } from 'react';
import { expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

import { aBreachSummaryDTO } from '~/testkit/builders';
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
    };
    when: {
        created: () => Promise<void>;
        theSummaryArrives: () => Promise<void>;
    };
    assert: {
        tileReads: (tile: SummaryTile, value: string) => Promise<void>;
        tileSupportReads: (tile: SummaryTile, support: string) => Promise<void>;
        skeletonTilesAreShown: () => void;
        tilesAreShown: () => Promise<void>;
    };
};

export const makeBreachSummaryDriver = (): BreachSummaryDriver => {
    let releaseSummary: (() => void) | undefined = undefined;

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
                await act(async () => {
                    renderWithProviders(
                        <BreachCatalogProvider>
                            <BreachSummary />
                        </BreachCatalogProvider>,
                    );
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
        },
    };
};
