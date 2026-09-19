import { expect } from 'vitest';
import { act, type ReactElement } from 'react';
import { cleanup, screen } from '@testing-library/react';

import { useLoadedState } from '~/hooks/useLoadedState';
import { RenderMode, renderWithProviders } from '~/testkit/renderWithProviders';

export const LOADING = 'loading';

// A loader that answers only when the test says so, and counts how often it was asked. Nothing
// here goes near HTTP: the hook's whole subject is how often it asks and whose answer it applies.
export type LoadedStateDriver = {
    given: { theLoadAnswersWith: (value: string) => void };
    when: {
        created: () => Promise<void>;
        theLoadAnswers: () => Promise<void>;
        reloaded: () => Promise<void>;
        unmounted: () => Promise<void>;
    };
    assert: {
        wasAsked: (times: number) => void;
        isShowing: (value: string) => void;
        nothingWasShownAfterUnmount: () => void;
    };
};

export const makeLoadedStateDriver = (): LoadedStateDriver => {
    let asked = 0;
    let answer = 'the record';
    let release: (() => void) | undefined = undefined;
    const shown: string[] = [];
    let reloadFromHook: (() => void) | undefined = undefined;

    const load = (): Promise<string> =>
        new Promise<string>((resolve) => {
            asked += 1;
            release = (): void => {
                resolve(answer);
            };
        });

    const Host = (): ReactElement => {
        const { state, reload } = useLoadedState({ load, loading: LOADING });
        reloadFromHook = reload;
        shown.push(state);

        return <span>{state}</span>;
    };

    const releaseTheLoad = async (): Promise<void> => {
        const answered = release;
        if (answered === undefined) throw new Error('LoadedStateDriver: nothing is loading');
        await act(async () => {
            answered();
        });
    };

    return {
        given: {
            theLoadAnswersWith: (value: string): void => {
                answer = value;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    // Strict, because that is what `main.tsx` ships and what asks twice.
                    renderWithProviders(<Host />, { mode: RenderMode.Strict });
                });
            },
            theLoadAnswers: releaseTheLoad,
            reloaded: async (): Promise<void> => {
                const reload = reloadFromHook;
                if (reload === undefined) throw new Error('LoadedStateDriver: when.created first');
                await act(async () => {
                    reload();
                });
            },
            unmounted: async (): Promise<void> => {
                await act(async () => {
                    cleanup();
                });
            },
        },
        assert: {
            wasAsked: (times: number): void => {
                expect(asked).toBe(times);
            },
            isShowing: (value: string): void => {
                expect(screen.getByText(value)).toBeInTheDocument();
            },
            // Nothing rendered after the component left: the answer to an unmounted load is
            // applied to nothing at all.
            nothingWasShownAfterUnmount: (): void => {
                expect(shown.filter((rendered) => rendered !== LOADING)).toStrictEqual([]);
            },
        },
    };
};
