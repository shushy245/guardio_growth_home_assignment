import { act } from 'react';
import { expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import type { BreachSummaryDTO } from '~/models/breach';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { BreachFilters } from '~/components/BreachFilters';
import { aBreachDTO, aBreachSummaryDTO } from '~/testkit/builders';
import { SearchFieldTestIds } from '~/components/SearchField.utils';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { BreachCatalogProvider } from '~/providers/BreachCatalogProvider';
import {
    BreachFiltersTestIds,
    dataClassChipTestId,
    type SortOption,
    sortSegmentTestId,
} from '~/components/BreachFilters.utils';

const SUMMARY_PATH = '/breaches/summary';
const LIST_PATH = '/breaches';
const PAGE_SIZE = 20;

export type BreachFiltersDriver = {
    given: {
        theSummary: (summary: BreachSummaryDTO) => void;
        theListHolds: (total: number) => void;
    };
    when: { created: () => Promise<void> };
    type: { intoSearch: (text: string) => Promise<void> };
    click: {
        sort: (option: SortOption) => Promise<void>;
        dataClass: (dataClass: string) => Promise<void>;
        verifiedOnly: () => Promise<void>;
        clearFilters: () => Promise<void>;
    };
    assert: {
        lastListQueryWas: (query: Record<string, string>) => Promise<void>;
        listRequestsSent: (count: number) => void;
        sortIsSelected: (option: SortOption) => void;
        dataClassIsSelected: (dataClass: string) => void;
        noDataClassIsSelected: () => void;
        resultsLineReads: (text: string) => Promise<void>;
        clearFiltersIsOffered: () => Promise<void>;
        clearFiltersIsNotOffered: () => void;
        searchIsEmpty: () => void;
    };
};

export const makeBreachFiltersDriver = (): BreachFiltersDriver => {
    const user = userEvent.setup();

    fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: aBreachSummaryDTO().build() });
    fakeHttp.respond({
        method: HttpMethod.Get,
        path: LIST_PATH,
        status: 200,
        body: { items: [aBreachDTO().build()], total: 1, page: 1, limit: PAGE_SIZE },
    });

    const listRequests = (): Record<string, string>[] =>
        fakeHttp
            .requests()
            .filter((request) => request.method === HttpMethod.Get && request.path.startsWith(LIST_PATH))
            .filter((request) => !request.path.startsWith(SUMMARY_PATH))
            .map((request) => request.query);

    const lastListQuery = (): Record<string, string> => {
        const last = listRequests().at(-1);
        if (last === undefined) throw new Error('BreachFiltersDriver: no list request was sent');

        return last;
    };

    return {
        given: {
            theSummary: (summary: BreachSummaryDTO): void => {
                fakeHttp.respond({ method: HttpMethod.Get, path: SUMMARY_PATH, status: 200, body: summary });
            },
            theListHolds: (total: number): void => {
                const items = Array.from({ length: Math.min(total, PAGE_SIZE) }, (_, index) =>
                    aBreachDTO().withName(`Breach${index}`).build(),
                );
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: LIST_PATH,
                    status: 200,
                    body: { items, total, page: 1, limit: PAGE_SIZE },
                });
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <BreachCatalogProvider>
                            <BreachFilters />
                        </BreachCatalogProvider>,
                    );
                });
            },
        },
        type: {
            intoSearch: async (text: string): Promise<void> => {
                await user.type(screen.getByTestId(SearchFieldTestIds.Input), text);
            },
        },
        click: {
            sort: async (option: SortOption): Promise<void> => {
                await user.click(screen.getByTestId(sortSegmentTestId(option)));
            },
            dataClass: async (dataClass: string): Promise<void> => {
                await user.click(await screen.findByTestId(dataClassChipTestId(dataClass)));
            },
            verifiedOnly: async (): Promise<void> => {
                await user.click(screen.getByTestId(BreachFiltersTestIds.VerifiedOnly));
            },
            clearFilters: async (): Promise<void> => {
                await user.click(screen.getByTestId(BreachFiltersTestIds.ClearFilters));
            },
        },
        assert: {
            // The whole query, so a parameter that should have been dropped cannot linger unseen.
            lastListQueryWas: async (query: Record<string, string>): Promise<void> => {
                await waitFor(() => {
                    expect(lastListQuery()).toStrictEqual(query);
                });
            },
            listRequestsSent: (count: number): void => {
                expect(listRequests()).toHaveLength(count);
            },
            sortIsSelected: (option: SortOption): void => {
                expect(screen.getByTestId(sortSegmentTestId(option))).toHaveAttribute('aria-pressed', 'true');
            },
            dataClassIsSelected: (dataClass: string): void => {
                expect(screen.getByTestId(dataClassChipTestId(dataClass))).toHaveAttribute('aria-pressed', 'true');
            },
            noDataClassIsSelected: (): void => {
                screen.getAllByTestId(/^BreachFiltersTestIds\.Chip\./).forEach((chip) => {
                    expect(chip).toHaveAttribute('aria-pressed', 'false');
                });
            },
            resultsLineReads: async (text: string): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(BreachFiltersTestIds.ResultsLine)).toHaveTextContent(text);
                });
            },
            clearFiltersIsOffered: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(BreachFiltersTestIds.ClearFilters)).toBeInTheDocument();
                });
            },
            clearFiltersIsNotOffered: (): void => {
                expect(screen.queryByTestId(BreachFiltersTestIds.ClearFilters)).not.toBeInTheDocument();
            },
            searchIsEmpty: (): void => {
                expect(screen.getByTestId(SearchFieldTestIds.Input)).toHaveValue('');
            },
        },
    };
};
