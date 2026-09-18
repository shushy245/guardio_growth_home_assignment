import { act } from 'react';
import { expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import type { BreachDTO } from '~/models/breach';
import { BreachList } from '~/components/BreachList';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { BreachFilters } from '~/components/BreachFilters';
import { BreachRowTestIds } from '~/components/BreachRow.utils';
import { BreachListTestIds } from '~/components/BreachList.utils';
import { ErrorStateTestIds } from '~/components/ErrorState.utils';
import { aBreachDTO, aBreachSummaryDTO } from '~/testkit/builders';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { BreachCatalogProvider } from '~/providers/BreachCatalogProvider';
import { BreachFiltersTestIds, dataClassChipTestId } from '~/components/BreachFilters.utils';

const SUMMARY_PATH = '/breaches/summary';
const LIST_PATH = '/breaches';
const PAGE_SIZE = 20;
const HTTP_SERVICE_UNAVAILABLE = 503;
const A_DATA_CLASS = 'Passwords';

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

export type BreachListDriver = {
    given: {
        theFirstPageIsSlowToArrive: () => void;
        theFirstPageHolds: (...names: string[]) => void;
        theSecondPageHolds: (...names: string[]) => void;
        theSecondPageIsSlowToArrive: (...names: string[]) => void;
        theListCannotBeLoaded: () => void;
        theFilteredRecordIsEmpty: () => void;
    };
    when: {
        created: () => Promise<void>;
        thePageArrives: () => Promise<void>;
    };
    click: {
        loadMore: () => Promise<void>;
        retry: () => Promise<void>;
        clearFilters: () => Promise<void>;
        dataClass: (dataClass: string) => Promise<void>;
    };
    assert: {
        rowsAre: (...titles: string[]) => Promise<void>;
        skeletonRowsAreShown: () => void;
        errorIsShown: () => Promise<void>;
        errorIsNotShown: () => void;
        emptyFilterStateIsShown: () => Promise<void>;
        loadMoreIsOffered: () => Promise<void>;
        loadMoreIsNotOffered: () => void;
        loadMoreIsBusy: () => void;
    };
};

export const makeBreachListDriver = (): BreachListDriver => {
    const user = userEvent.setup();
    let releasePage: (() => void) | undefined = undefined;

    fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: aBreachSummaryDTO().build() });
    fakeHttp.respond({ method: HttpMethod.Get, path: LIST_PATH, status: 200, body: pageOf(['Adobe'], 1, 1) });

    const gated = (): Promise<void> =>
        new Promise<void>((resolve) => {
            releasePage = resolve;
        });

    const rowTitles = (): string[] => screen.queryAllByTestId(BreachRowTestIds.Title).map((title) => title.textContent);

    return {
        given: {
            theFirstPageIsSlowToArrive: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: LIST_PATH,
                    status: 200,
                    body: pageOf(['Adobe'], 1, 1),
                    gate: gated(),
                });
            },
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
                    body: pageOf(names, 2, PAGE_SIZE + names.length),
                });
            },
            theSecondPageIsSlowToArrive: (...names: string[]): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: `${LIST_PATH}?page=2`,
                    status: 200,
                    body: pageOf(names, 2, PAGE_SIZE + names.length),
                    gate: gated(),
                });
            },
            theListCannotBeLoaded: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: LIST_PATH,
                    status: HTTP_SERVICE_UNAVAILABLE,
                    body: { error: 'the catalog is empty' },
                });
            },
            theFilteredRecordIsEmpty: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: `${LIST_PATH}?dataClass=${A_DATA_CLASS}`,
                    status: 200,
                    body: pageOf([], 1, 0),
                });
            },
        },
        when: {
            // The filter bar renders beside the list, as it does on the result page: the empty
            // state's Clear action and a chip are how a visitor gets into and out of it.
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <BreachCatalogProvider>
                            <BreachFilters />
                            <BreachList />
                        </BreachCatalogProvider>,
                    );
                });
            },
            thePageArrives: async (): Promise<void> => {
                const release = releasePage;
                if (release === undefined) throw new Error('BreachListDriver: no page is waiting to be released');
                await act(async () => {
                    release();
                });
            },
        },
        click: {
            loadMore: async (): Promise<void> => {
                await user.click(screen.getByTestId(BreachListTestIds.LoadMore));
            },
            retry: async (): Promise<void> => {
                await user.click(screen.getByTestId(ErrorStateTestIds.Retry));
            },
            clearFilters: async (): Promise<void> => {
                await user.click(screen.getByTestId(BreachListTestIds.ClearFilters));
            },
            dataClass: async (dataClass: string): Promise<void> => {
                await user.click(await screen.findByTestId(dataClassChipTestId(dataClass)));
            },
        },
        assert: {
            rowsAre: async (...titles: string[]): Promise<void> => {
                await waitFor(() => {
                    expect(rowTitles()).toStrictEqual(titles);
                });
            },
            skeletonRowsAreShown: (): void => {
                expect(screen.getByTestId(BreachListTestIds.Skeleton)).toBeInTheDocument();
                expect(rowTitles()).toStrictEqual([]);
            },
            errorIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(ErrorStateTestIds.Root)).toBeInTheDocument();
                });
                expect(rowTitles()).toStrictEqual([]);
            },
            errorIsNotShown: (): void => {
                expect(screen.queryByTestId(ErrorStateTestIds.Root)).not.toBeInTheDocument();
            },
            emptyFilterStateIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(BreachListTestIds.EmptyFilter)).toBeInTheDocument();
                });
                expect(screen.queryByTestId(ErrorStateTestIds.Root)).not.toBeInTheDocument();
                expect(screen.getByTestId(BreachFiltersTestIds.ResultsLine)).toHaveTextContent('Showing 0 of 0');
            },
            loadMoreIsOffered: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(BreachListTestIds.LoadMore)).toBeEnabled();
                });
            },
            loadMoreIsNotOffered: (): void => {
                expect(screen.queryByTestId(BreachListTestIds.LoadMore)).not.toBeInTheDocument();
            },
            loadMoreIsBusy: (): void => {
                expect(screen.getByTestId(BreachListTestIds.LoadMore)).toBeDisabled();
                expect(screen.getByTestId(BreachListTestIds.LoadMore)).toHaveAttribute('aria-busy', 'true');
            },
        },
    };
};
