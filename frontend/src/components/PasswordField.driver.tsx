import { expect, vi } from 'vitest';
import { act, type ReactElement, useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';

import { logger } from '~/logging/logger';
import { PasswordField } from '~/components/PasswordField';
import { removeWebCryptoSubtle } from '~/testkit/web-crypto';
import { settleNativeAsyncWork } from '~/testkit/native-async';
import { usePasswordLeakCheck } from '~/hooks/usePasswordLeakCheck';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { PASSWORD_CHECK_DEBOUNCE_MS, PASSWORD_LABEL, PasswordFieldTestIds } from '~/components/PasswordField.utils';
import {
    RANGE_PATH,
    rangePathsRequested,
    rangeRequestsAbandoned,
    theProxyFailsFor,
    theRangeIsCleanFor,
    theRangeIsSlowToSay,
    theRangeSays,
    PROXY_FAILURE_DETAIL,
} from '~/testkit/pwned-passwords';

// A test-only parent wired the way the sign-up page wires it: it holds the password, runs the
// check on it, and hands both to the field.
const PasswordFieldHost = (): ReactElement => {
    const [password, setPassword] = useState('');
    const check = usePasswordLeakCheck(password);

    return <PasswordField value={password} onChange={setPassword} check={check} validationError={undefined} />;
};

export type PasswordFieldDriver = {
    given: {
        theRangeSays: (leak: { password: string; count: number }) => Promise<void>;
        theRangeIsCleanFor: (password: string) => Promise<void>;
        theRangeIsSlowToSay: (leak: { password: string; count: number }) => Promise<void>;
        theProxyFailsFor: (password: string) => Promise<void>;
        theBrowserHasNoWebCrypto: () => void;
    };
    when: {
        created: () => Promise<void>;
        thePausePasses: () => Promise<void>;
        almostThePausePasses: () => Promise<void>;
        theSlowRangeArrives: () => Promise<void>;
    };
    type: { password: (text: string) => Promise<void> };
    clear: { password: () => Promise<void> };
    assert: {
        checkingIsShown: () => void;
        leakedWarningIsShown: (count: number) => void;
        noWarningIsShown: () => void;
        uncheckedNoteIsShown: () => void;
        noUncheckedNoteIsShown: () => void;
        rangesAbandoned: (...prefixes: string[]) => void;
        rangesRequested: (...prefixes: string[]) => void;
        fieldIsEditable: () => void;
        fieldIsNamedByItsLabelAlone: () => void;
        leakWarningDescribesTheField: (count: number) => void;
        checkFailureWasLogged: () => void;
    };
};

export const makePasswordFieldDriver = (): PasswordFieldDriver => {
    // Only the clock the pause is measured on; promises and the fake network stay real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let releaseSlowRange: (() => void) | undefined = undefined;
    const loggedErrors = vi.spyOn(logger, 'error').mockImplementation(() => {});

    const field = (): HTMLInputElement => {
        const element = screen.getByTestId(PasswordFieldTestIds.Input);
        if (!(element instanceof HTMLInputElement)) throw new Error('PasswordFieldDriver: the field is not an input');

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
            theRangeSays: async ({ password, count }): Promise<void> => {
                await theRangeSays({ password, count });
            },
            theRangeIsCleanFor: async (password: string): Promise<void> => {
                await theRangeIsCleanFor(password);
            },
            theRangeIsSlowToSay: async ({ password, count }): Promise<void> => {
                releaseSlowRange = await theRangeIsSlowToSay({ password, count });
            },
            theProxyFailsFor: async (password: string): Promise<void> => {
                await theProxyFailsFor(password);
            },
            // Plain http off localhost: the browser leaves `crypto.subtle` undefined.
            theBrowserHasNoWebCrypto: removeWebCryptoSubtle,
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(<PasswordFieldHost />);
                });
            },
            // The pause ends and the check that follows it — hash, request, answer — settles.
            thePausePasses: async (): Promise<void> => {
                await act(async () => {
                    vi.advanceTimersByTime(PASSWORD_CHECK_DEBOUNCE_MS);
                    await settleNativeAsyncWork();
                });
            },
            // One millisecond short of the pause: advancing by exactly the constant proves one
            // request per settle and nothing about the wait, so a debounce of 0 passes it (BF85).
            almostThePausePasses: async (): Promise<void> => {
                await act(async () => {
                    vi.advanceTimersByTime(PASSWORD_CHECK_DEBOUNCE_MS - 1);
                });
            },
            theSlowRangeArrives: async (): Promise<void> => {
                const release = releaseSlowRange;
                if (release === undefined) throw new Error('PasswordFieldDriver: no range is waiting to be released');
                await act(async () => {
                    release();
                });
            },
        },
        type: {
            // One change event per character, as a keyboard produces.
            password: async (text: string): Promise<void> => {
                for (const character of Array.from(text)) {
                    await setFieldValue(`${field().value}${character}`);
                }
            },
        },
        clear: {
            password: async (): Promise<void> => {
                await setFieldValue('');
            },
        },
        assert: {
            // Synchronous on purpose: every `when` settles the tree inside `act`, and `waitFor`
            // drains through a `setTimeout` this driver has faked.
            checkingIsShown: (): void => {
                expect(screen.getByTestId(PasswordFieldTestIds.Checking)).toBeInTheDocument();
            },
            leakedWarningIsShown: (count: number): void => {
                expect(screen.getByTestId(PasswordFieldTestIds.Leaked)).toHaveTextContent(
                    count.toLocaleString('en-US'),
                );
            },
            noWarningIsShown: (): void => {
                expect(screen.queryByTestId(PasswordFieldTestIds.Leaked)).not.toBeInTheDocument();
            },
            uncheckedNoteIsShown: (): void => {
                expect(screen.getByTestId(PasswordFieldTestIds.Unchecked)).toBeInTheDocument();
            },
            noUncheckedNoteIsShown: (): void => {
                expect(screen.queryByTestId(PasswordFieldTestIds.Unchecked)).not.toBeInTheDocument();
            },
            rangesAbandoned: (...prefixes: string[]): void => {
                expect(rangeRequestsAbandoned()).toStrictEqual(prefixes.map((prefix) => `${RANGE_PATH}/${prefix}`));
            },
            rangesRequested: (...prefixes: string[]): void => {
                expect(rangePathsRequested()).toStrictEqual(prefixes.map((prefix) => `${RANGE_PATH}/${prefix}`));
            },
            fieldIsEditable: (): void => {
                expect(field()).toBeEnabled();
            },
            // Exact, not a prefix: a notice inside the label joins the accessible name, and a
            // name that changes as the visitor types is a field a screen reader renames under
            // them (BF62). An anchored regex would pass on exactly the polluted name.
            fieldIsNamedByItsLabelAlone: (): void => {
                expect(field()).toHaveAccessibleName(PASSWORD_LABEL);
            },
            leakWarningDescribesTheField: (count: number): void => {
                expect(field()).toHaveAccessibleDescription(expect.stringContaining(count.toLocaleString('en-US')));
            },
            // The proxy's own 503 body reached the log — proof the failure the field reports is
            // the server's, not a fixture that never matched.
            checkFailureWasLogged: (): void => {
                expect(loggedErrors).toHaveBeenCalledWith(
                    expect.stringContaining('checkPassword'),
                    expect.objectContaining({ detail: PROXY_FAILURE_DETAIL }),
                );
            },
        },
    };
};
