import { expect, vi } from 'vitest';
import { act, type ReactElement, useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';

import { PasswordField } from '~/components/PasswordField';
import { removeWebCryptoSubtle } from '~/testkit/web-crypto';
import { settleNativeAsyncWork } from '~/testkit/native-async';
import { usePasswordLeakCheck } from '~/hooks/usePasswordLeakCheck';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';
import { PASSWORD_CHECK_DEBOUNCE_MS, PasswordFieldTestIds, sha1Hex, splitHash } from '~/components/PasswordField.utils';

const RANGE_PATH = '/pwned-passwords/range';
const HTTP_SERVICE_UNAVAILABLE = 503;
// A padding line the range API adds under `Add-Padding`: a suffix seen zero times.
const A_PADDING_LINE = '0018A45C4D1DEF81644B54AB7F969B88D65:0';

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
        theProxyFails: () => void;
        theBrowserHasNoWebCrypto: () => void;
    };
    when: {
        created: () => Promise<void>;
        thePausePasses: () => Promise<void>;
        theSlowRangeArrives: () => Promise<void>;
    };
    type: { password: (text: string) => Promise<void> };
    assert: {
        checkingIsShown: () => void;
        leakedWarningIsShown: (count: number) => void;
        noWarningIsShown: () => void;
        uncheckedNoteIsShown: () => void;
        rangesRequested: (...prefixes: string[]) => void;
        fieldIsEditable: () => void;
    };
};

export const makePasswordFieldDriver = (): PasswordFieldDriver => {
    // Only the clock the pause is measured on; promises and the fake network stay real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    let releaseSlowRange: (() => void) | undefined = undefined;

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

    const rangeRequests = (): RecordedRequest[] =>
        fakeHttp
            .requests()
            .filter((request) => request.method === HttpMethod.Get && request.path.startsWith(`${RANGE_PATH}/`));

    const respondForPassword = async ({
        password,
        text,
        gate,
    }: {
        password: string;
        text: string;
        gate?: Promise<void> | undefined;
    }): Promise<void> => {
        const { prefix } = splitHash(await sha1Hex(password));
        const route = { method: HttpMethod.Get, path: `${RANGE_PATH}/${prefix}`, status: 200, body: text };
        fakeHttp.respond(gate === undefined ? route : { ...route, gate });
    };

    const leakedText = async ({ password, count }: { password: string; count: number }): Promise<string> => {
        const { suffix } = splitHash(await sha1Hex(password));

        return [A_PADDING_LINE, `${suffix}:${count}`].join('\r\n');
    };

    return {
        given: {
            theRangeSays: async ({ password, count }): Promise<void> => {
                await respondForPassword({ password, text: await leakedText({ password, count }) });
            },
            theRangeIsCleanFor: async (password: string): Promise<void> => {
                await respondForPassword({ password, text: A_PADDING_LINE });
            },
            theRangeIsSlowToSay: async ({ password, count }): Promise<void> => {
                const gate = new Promise<void>((resolve) => {
                    releaseSlowRange = resolve;
                });
                await respondForPassword({ password, text: await leakedText({ password, count }), gate });
            },
            theProxyFails: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: RANGE_PATH,
                    status: HTTP_SERVICE_UNAVAILABLE,
                    body: { error: 'the password-leak source is unavailable' },
                });
            },
            // Plain http off localhost: the browser leaves `crypto.subtle` undefined.
            theBrowserHasNoWebCrypto: (): void => {
                removeWebCryptoSubtle();
            },
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
            rangesRequested: (...prefixes: string[]): void => {
                expect(rangeRequests().map((request) => request.path)).toStrictEqual(
                    prefixes.map((prefix) => `${RANGE_PATH}/${prefix}`),
                );
            },
            fieldIsEditable: (): void => {
                expect(field()).toBeEnabled();
            },
        },
    };
};
