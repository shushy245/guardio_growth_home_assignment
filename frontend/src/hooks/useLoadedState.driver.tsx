import { expect } from 'vitest';
import { act, type ReactElement } from 'react';
import { screen } from '@testing-library/react';

import { useLoadedState } from '~/hooks/useLoadedState';
import { renderWithProviders } from '~/testkit/renderWithProviders';

export const LOADING = 'loading';

// A loader that answers only when the test says so, and counts how often it was asked. Nothing
// here goes near HTTP: the hook's whole subject is how often it asks and whose answer it applies.
export type LoadedStateDriver = {
    given: { theLoadAnswersWith: (value: string) => void };
    when: {
        created: () => Promise<void>;
        theLoadAnswers: () => Promise<void>;
        theSupersededLoadAnswers: (value: string) => Promise<void>;
        reloaded: () => Promise<void>;
    };
    assert: {
        wasAsked: (times: number) => void;
        isShowing: (value: string) => void;
    };
};

export const makeLoadedStateDriver = (): LoadedStateDriver => {
    let asked = 0;
    let answer = 'the record';
    // One resolver per load the hook started, oldest first: a superseded attempt is still
    // waiting to answer, and answering it late is the thing the hook has to ignore.
    const waiting: ((value: string) => void)[] = [];
    let reloadFromHook: (() => void) | undefined = undefined;

    const load = (): Promise<string> =>
        new Promise<string>((resolve) => {
            asked += 1;
            waiting.push(resolve);
        });

    const Host = (): ReactElement => {
        const { state, reload } = useLoadedState({ load, loading: LOADING });
        reloadFromHook = reload;

        return <span>{state}</span>;
    };

    const answerLoad = async ({ index, value }: { index: number; value: string }): Promise<void> => {
        const resolve = waiting[index];
        if (resolve === undefined) throw new Error(`LoadedStateDriver: no load is waiting at ${index}`);
        await act(async () => {
            resolve(value);
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
                    renderWithProviders(<Host />);
                });
            },
            // The most recent load — the one the screen is waiting for.
            theLoadAnswers: async (): Promise<void> => {
                await answerLoad({ index: waiting.length - 1, value: answer });
            },
            // The one a reload replaced, answering after the newer one already has.
            theSupersededLoadAnswers: async (value: string): Promise<void> => {
                await answerLoad({ index: 0, value });
            },
            reloaded: async (): Promise<void> => {
                const reload = reloadFromHook;
                if (reload === undefined) throw new Error('LoadedStateDriver: when.created first');
                await act(async () => {
                    reload();
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
        },
    };
};
