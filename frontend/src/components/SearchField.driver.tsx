import { expect, vi } from 'vitest';
import { act, type ReactElement, useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';

import { SearchField } from '~/components/SearchField';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { SEARCH_DEBOUNCE_MS, SearchFieldTestIds } from '~/components/SearchField.utils';

// A test-only parent that holds the query the way the filter bar does: a search it is told about
// becomes the query it passes back down, and something else on the page can clear it.
export enum SearchFieldProbeTestIds {
    ClearFromOutside = 'SearchFieldProbeTestIds.ClearFromOutside',
}

const SearchFieldHost = ({
    initialQuery,
    onSearch,
}: {
    initialQuery: string | undefined;
    onSearch: (query: string | undefined) => void;
}): ReactElement => {
    const [query, setQuery] = useState(initialQuery);

    const handleSearch = (next: string | undefined): void => {
        onSearch(next);
        setQuery(next);
    };
    const handleClearFromOutside = (): void => {
        setQuery(undefined);
    };

    return (
        <div>
            <SearchField query={query} onSearch={handleSearch} />
            <button
                type="button"
                data-testid={SearchFieldProbeTestIds.ClearFromOutside}
                onClick={handleClearFromOutside}
            >
                {`clear`}
            </button>
        </div>
    );
};

export type SearchFieldDriver = {
    given: { theCurrentQuery: (query: string) => void };
    when: {
        created: () => Promise<void>;
        thePausePasses: () => Promise<void>;
    };
    type: { intoSearch: (text: string) => Promise<void> };
    clear: {
        search: () => Promise<void>;
        fromOutside: () => Promise<void>;
    };
    assert: {
        searchedFor: (...queries: (string | undefined)[]) => void;
        fieldReads: (text: string) => void;
    };
};

export const makeSearchFieldDriver = (): SearchFieldDriver => {
    // Only the clock the pause is measured on; the field itself needs nothing else faked.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const onSearch = vi.fn<(query: string | undefined) => void>();
    let initialQuery: string | undefined = undefined;

    const field = (): HTMLInputElement => {
        const element = screen.getByTestId(SearchFieldTestIds.Input);
        if (!(element instanceof HTMLInputElement)) throw new Error('SearchFieldDriver: the search is not an input');

        return element;
    };

    // `fireEvent`, because user-event settles through a `setTimeout` this driver has faked.
    const setFieldValue = async (value: string): Promise<void> => {
        await act(async () => {
            fireEvent.change(field(), { target: { value } });
        });
    };

    return {
        given: {
            theCurrentQuery: (query: string): void => {
                initialQuery = query;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(<SearchFieldHost initialQuery={initialQuery} onSearch={onSearch} />);
                });
            },
            thePausePasses: async (): Promise<void> => {
                await act(async () => {
                    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
                });
            },
        },
        type: {
            // One change event per character, as a keyboard produces.
            intoSearch: async (text: string): Promise<void> => {
                for (const character of Array.from(text)) {
                    await setFieldValue(`${field().value}${character}`);
                }
            },
        },
        clear: {
            search: async (): Promise<void> => {
                await setFieldValue('');
            },
            fromOutside: async (): Promise<void> => {
                await act(async () => {
                    fireEvent.click(screen.getByTestId(SearchFieldProbeTestIds.ClearFromOutside));
                });
            },
        },
        assert: {
            searchedFor: (...queries: (string | undefined)[]): void => {
                expect(onSearch.mock.calls.map(([query]) => query)).toStrictEqual(queries);
            },
            fieldReads: (text: string): void => {
                expect(field()).toHaveValue(text);
            },
        },
    };
};
