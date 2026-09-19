import { expect } from 'vitest';
import { act, type ReactElement } from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

import type { BreachDTO } from '~/models/breach';
import { aBreachDTO, aBreachSummaryDTO } from '~/testkit/builders';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';
import { BreachCatalogProvider, useBreachCatalog } from '~/providers/BreachCatalogProvider';
import { hasItems, isListReady, isSummaryReady } from '~/providers/BreachCatalogProvider.utils';

const SUMMARY_PATH = '/breaches/summary';
const LIST_PATH = '/breaches';
const PAGE_SIZE = 20;
const A_DATA_CLASS = 'Passwords';

// A test-only consumer: what any funnel page does with the catalog — mount, read it, and ask it
// for a narrower record or the next page.
export enum CatalogProbeTestIds {
    Ready = 'CatalogProbeTestIds.Ready',
    Items = 'CatalogProbeTestIds.Items',
    FilterByDataClass = 'CatalogProbeTestIds.FilterByDataClass',
    LoadMore = 'CatalogProbeTestIds.LoadMore',
}

const CatalogProbe = (): ReactElement => {
    const { summary, list, filters, setFilters, loadMore } = useBreachCatalog();

    const handleFilter = (): void => {
        setFilters({ ...filters, dataClass: A_DATA_CLASS });
    };

    return (
        <div>
            <button type="button" data-testid={CatalogProbeTestIds.FilterByDataClass} onClick={handleFilter}>
                {`filter`}
            </button>
            <button type="button" data-testid={CatalogProbeTestIds.LoadMore} onClick={loadMore}>
                {`more`}
            </button>
            {isSummaryReady(summary) && isListReady(list) ? (
                <span data-testid={CatalogProbeTestIds.Ready}>{`ready`}</span>
            ) : undefined}
            {hasItems(list) ? (
                <span data-testid={CatalogProbeTestIds.Items}>{list.items.map((item) => item.name).join(',')}</span>
            ) : undefined}
        </div>
    );
};

export type BreachCatalogProviderDriver = {
    given: {
        consumers: (count: number) => void;
        theFirstPageIsSlowToArrive: () => void;
        theFirstPageHolds: (...names: string[]) => void;
        theSecondPageHolds: (...names: string[]) => void;
        theFilteredRecordHolds: (...names: string[]) => void;
    };
    when: {
        created: () => Promise<void>;
        theFirstPageArrives: () => Promise<void>;
        unmounted: () => Promise<void>;
    };
    click: {
        filterByDataClass: () => Promise<void>;
        loadMore: () => Promise<void>;
    };
    assert: {
        everyConsumerReadsTheCatalog: () => Promise<void>;
        catalogFetched: (times: number) => void;
        summaryFetched: (times: number) => void;
        itemsAre: (...names: string[]) => Promise<void>;
        listRequestsWere: (...queries: Record<string, string>[]) => Promise<void>;
        listRequestWasAborted: (index: number) => void;
        listRequestWasNotAborted: (index: number) => void;
    };
};

const pageOf = (
    names: string[],
    page: number,
    total: number,
): { items: BreachDTO[]; total: number; page: number; limit: number } => ({
    items: names.map((name) => aBreachDTO().withName(name).build()),
    total,
    page,
    limit: PAGE_SIZE,
});

export const makeBreachCatalogProviderDriver = (): BreachCatalogProviderDriver => {
    let consumers = 1;
    let releaseFirstPage: (() => void) | undefined = undefined;

    fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: aBreachSummaryDTO().build() });
    fakeHttp.respond({ method: HttpMethod.Get, path: LIST_PATH, status: 200, body: pageOf(['Adobe'], 1, 1) });

    const fetchesOf = (path: string): RecordedRequest[] =>
        fakeHttp.requests().filter((request) => request.method === HttpMethod.Get && request.path === path);

    const listRequests = (): RecordedRequest[] =>
        fakeHttp
            .requests()
            .filter((request) => request.method === HttpMethod.Get)
            .filter((request) => request.path.startsWith(LIST_PATH) && !request.path.startsWith(SUMMARY_PATH));

    const listRequestAt = (index: number): RecordedRequest => {
        const request = listRequests()[index];
        if (request === undefined) throw new Error(`BreachCatalogProviderDriver: no list request #${index}`);

        return request;
    };

    return {
        given: {
            consumers: (count: number): void => {
                consumers = count;
            },
            theFirstPageIsSlowToArrive: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: LIST_PATH,
                    status: 200,
                    body: pageOf(['Adobe'], 1, 1),
                    gate: new Promise<void>((resolve) => {
                        releaseFirstPage = resolve;
                    }),
                });
            },
            // Two pages' worth: the first page lists these and says there is more.
            theFirstPageHolds: (...names: string[]): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: LIST_PATH,
                    status: 200,
                    body: pageOf(names, 1, names.length + PAGE_SIZE),
                });
            },
            theSecondPageHolds: (...names: string[]): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: `${LIST_PATH}?page=2`,
                    status: 200,
                    body: pageOf(names, 2, names.length + PAGE_SIZE),
                });
            },
            theFilteredRecordHolds: (...names: string[]): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: `${LIST_PATH}?dataClass=${A_DATA_CLASS}`,
                    status: 200,
                    body: pageOf(names, 1, names.length),
                });
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
            theFirstPageArrives: async (): Promise<void> => {
                const release = releaseFirstPage;
                if (release === undefined)
                    throw new Error('BreachCatalogProviderDriver: the first page is not waiting');
                await act(async () => {
                    release();
                });
            },
            // The visitor leaves the funnel: the provider unmounts with a page still in flight.
            unmounted: async (): Promise<void> => {
                await act(async () => {
                    cleanup();
                });
            },
        },
        click: {
            filterByDataClass: async (): Promise<void> => {
                await act(async () => {
                    fireEvent.click(screen.getAllByTestId(CatalogProbeTestIds.FilterByDataClass)[0] ?? document.body);
                });
            },
            loadMore: async (): Promise<void> => {
                await act(async () => {
                    fireEvent.click(screen.getAllByTestId(CatalogProbeTestIds.LoadMore)[0] ?? document.body);
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
            // The tiles alone: the summary answers the record as a whole and a filter narrows
            // the list under it, so refetching it on a chip would flash the skeleton for figures
            // that did not change (BF81).
            summaryFetched: (times: number): void => {
                expect(fetchesOf(SUMMARY_PATH)).toHaveLength(times);
            },
            itemsAre: async (...names: string[]): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getAllByTestId(CatalogProbeTestIds.Items)[0]).toHaveTextContent(names.join(','));
                });
            },
            // Every list request in order, each as its whole query.
            listRequestsWere: async (...queries: Record<string, string>[]): Promise<void> => {
                await waitFor(() => {
                    expect(listRequests().map((request) => request.query)).toStrictEqual(queries);
                });
            },
            listRequestWasAborted: (index: number): void => {
                expect(listRequestAt(index).isAborted()).toBe(true);
            },
            listRequestWasNotAborted: (index: number): void => {
                expect(listRequestAt(index).isAborted()).toBe(false);
            },
        },
    };
};
