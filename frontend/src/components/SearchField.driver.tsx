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
    echoesLate,
    onSearch,
    onEchoReady,
}: {
    initialQuery: string | undefined;
    echoesLate: boolean;
    onSearch: (query: string | undefined) => void;
    onEchoReady: (echo: () => void) => void;
}): ReactElement => {
    const [query, setQuery] = useState(initialQuery);

    const handleSearch = (next: string | undefined): void => {
        onSearch(next);
        // A page that answers the search a moment later, as the real one does: the catalog
        // provider updates its filters, re-renders, and the query comes back down after the
        // visitor has typed more. Immediately is the easy case and hides the echo guard (BF80).
        if (echoesLate) {
            onEchoReady(() => {
                setQuery(next);
            });

            return;
        }
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
    given: {
        theCurrentQuery: (query: string) => void;
        thePageAnswersTheSearchLate: () => void;
    };
    when: {
        created: () => Promise<void>;
        thePausePasses: () => Promise<void>;
        almostThePausePasses: () => Promise<void>;
        thePageAnswers: () => Promise<void>;
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
    let echoesLate = false;
    let pendingEcho: (() => void) | undefined = undefined;

    // Named, not inline in the JSX: the driver's host is a component like any other, and the
    // handler says what the page does with the echo it was handed.
    const handleEchoReady = (echo: () => void): void => {
        pendingEcho = echo;
    };

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
            thePageAnswersTheSearchLate: (): void => {
                echoesLate = true;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <SearchFieldHost
                            initialQuery={initialQuery}
                            echoesLate={echoesLate}
                            onSearch={onSearch}
                            onEchoReady={handleEchoReady}
                        />,
                    );
                });
            },
            thePausePasses: async (): Promise<void> => {
                await act(async () => {
                    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
                });
            },
            // One millisecond short of the pause. Advancing by exactly the constant proves one
            // request per settle and nothing about the wait itself: a debounce of 0 passes it
            // (BF85). This is the half that fails when the wait goes away.
            almostThePausePasses: async (): Promise<void> => {
                await act(async () => {
                    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
                });
            },
            thePageAnswers: async (): Promise<void> => {
                const echo = pendingEcho;
                if (echo === undefined) throw new Error('SearchFieldDriver: no search is waiting to be answered');
                pendingEcho = undefined;
                await act(async () => {
                    echo();
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
