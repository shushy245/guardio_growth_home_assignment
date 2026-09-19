import { expect, vi } from 'vitest';
import { act, type ReactElement } from 'react';
import { screen } from '@testing-library/react';

import { logger } from '~/logging/logger';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { ErrorStateTestIds } from '~/components/ErrorState.utils';
import { renderWithProviders } from '~/testkit/renderWithProviders';

export const THROWN_MESSAGE = 'FunnelBars: a third series has no colour';
const CHILD_TEXT = 'The screen that rendered';

export type ErrorBoundaryDriver = {
    given: { aChildThatThrowsWhileRendering: () => void };
    when: { created: () => Promise<void> };
    click: { retry: () => Promise<void> };
    assert: {
        theChildIsShown: () => void;
        theFailureIsShown: () => void;
        theFailureWasLogged: () => void;
        thePageWasReloaded: () => void;
        nothingWasReloaded: () => void;
    };
};

export const makeErrorBoundaryDriver = (): ErrorBoundaryDriver => {
    let throwing = false;
    const loggedErrors = vi.spyOn(logger, 'error').mockImplementation(() => {});
    // React prints the caught error itself; the test's own output is not the subject.
    const consoleErrors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });

    const Child = (): ReactElement => {
        if (throwing) throw new Error(THROWN_MESSAGE);

        return <span>{CHILD_TEXT}</span>;
    };

    return {
        given: {
            aChildThatThrowsWhileRendering: (): void => {
                throwing = true;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <ErrorBoundary>
                            <Child />
                        </ErrorBoundary>,
                    );
                });
            },
        },
        click: {
            retry: async (): Promise<void> => {
                await act(async () => {
                    screen.getByTestId(ErrorStateTestIds.Retry).click();
                });
            },
        },
        assert: {
            theChildIsShown: (): void => {
                expect(screen.getByText(CHILD_TEXT)).toBeInTheDocument();
                expect(screen.queryByTestId(ErrorStateTestIds.Root)).not.toBeInTheDocument();
            },
            theFailureIsShown: (): void => {
                expect(screen.getByTestId(ErrorStateTestIds.Root)).toBeInTheDocument();
                expect(screen.getByTestId(ErrorStateTestIds.Retry)).toBeInTheDocument();
            },
            // The thrown message goes to the log, never to the panel: it is on-call detail.
            theFailureWasLogged: (): void => {
                expect(loggedErrors).toHaveBeenCalledWith(
                    expect.stringContaining('ErrorBoundary'),
                    expect.objectContaining({ detail: expect.stringContaining(THROWN_MESSAGE) }),
                );
                expect(screen.getByTestId(ErrorStateTestIds.Root)).not.toHaveTextContent(THROWN_MESSAGE);
                expect(consoleErrors).toHaveBeenCalled();
            },
            thePageWasReloaded: (): void => {
                expect(reload).toHaveBeenCalledTimes(1);
            },
            nothingWasReloaded: (): void => {
                expect(reload).not.toHaveBeenCalled();
            },
        },
    };
};
