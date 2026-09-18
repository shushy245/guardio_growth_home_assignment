import { act } from 'react';
import { expect } from 'vitest';
import type { ReactElement } from 'react';
import { screen, waitFor } from '@testing-library/react';

import { aBreachDTO, aBreachSummaryDTO } from '~/testkit/builders';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';
import { isListReady, isSummaryReady } from '~/providers/BreachCatalogProvider.utils';
import { BreachCatalogProvider, useBreachCatalog } from '~/providers/BreachCatalogProvider';

const SUMMARY_PATH = '/breaches/summary';
const LIST_PATH = '/breaches';

// A test-only consumer: what any funnel page does with the catalog — mount, and read it.
export enum CatalogProbeTestIds {
    Ready = 'CatalogProbeTestIds.Ready',
}

const CatalogProbe = (): ReactElement | undefined => {
    const { summary, list } = useBreachCatalog();
    if (!isSummaryReady(summary)) return undefined;
    if (!isListReady(list)) return undefined;

    return (
        <span
            data-testid={CatalogProbeTestIds.Ready}
        >{`${list.items.length} of ${summary.summary.totalBreaches}`}</span>
    );
};

export type BreachCatalogProviderDriver = {
    given: { consumers: (count: number) => void };
    when: { created: () => Promise<void> };
    assert: {
        everyConsumerReadsTheCatalog: () => Promise<void>;
        catalogFetched: (times: number) => void;
    };
};

export const makeBreachCatalogProviderDriver = (): BreachCatalogProviderDriver => {
    let consumers = 1;

    fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: aBreachSummaryDTO().build() });
    fakeHttp.respond({
        method: HttpMethod.Get,
        path: LIST_PATH,
        status: 200,
        body: { items: [aBreachDTO().build()], total: 1, page: 1, limit: 20 },
    });

    const fetchesOf = (path: string): RecordedRequest[] =>
        fakeHttp.requests().filter((request) => request.method === HttpMethod.Get && request.path === path);

    return {
        given: {
            consumers: (count: number): void => {
                consumers = count;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <BreachCatalogProvider>
                            {Array.from({ length: consumers }, (_, index) => (
                                <CatalogProbe key={index} />
                            ))}
                        </BreachCatalogProvider>,
                    );
                });
            },
        },
        assert: {
            everyConsumerReadsTheCatalog: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getAllByTestId(CatalogProbeTestIds.Ready)).toHaveLength(consumers);
                });
            },
            catalogFetched: (times: number): void => {
                expect(fetchesOf(SUMMARY_PATH)).toHaveLength(times);
                expect(fetchesOf(LIST_PATH)).toHaveLength(times);
            },
        },
    };
};
