import { act } from 'react';
import { expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';

import { Plan } from '~/models/signup';
import { Signup } from '~/pages/Signup';
import { logger } from '~/logging/logger';
import { FunnelEventName } from '~/models/funnelEvent';
import { isPlainObject } from '~/api/http-client.utils';
import { planCardMap } from '~/components/PlanPicker.utils';
import { FunnelProviders } from '~/providers/FunnelProviders';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { PasswordFieldTestIds } from '~/components/PasswordField.utils';
import { postedSteps, respondToFunnelEvents } from '~/testkit/funnel-events';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';
import { PROTECTED_ROUTE, type ProtectedRouteState, SignupTestIds } from '~/pages/Signup.utils';
import { theRangeIsCleanFor, theRangeIsSlowToSay, theRangeSays } from '~/testkit/pwned-passwords';

const SIGNUPS_PATH = '/signups';
const HTTP_CONFLICT = 409;
const HTTP_SERVER_ERROR = 500;
const SERVER_ERROR_DETAIL = 'internal error';
const A_CREATED_SIGNUP = { id: 'sup_01K5G6X0000000000000000000', createdAt: '2026-09-19T10:00:00.000Z' };

// Where a sign-up leads. A probe route rather than the real Protected page: this driver proves
// the page hands the visitor on with their plan, and the Protected driver proves what is there.
export enum SignupProbeTestIds {
    ProtectedRoute = 'SignupProbeTestIds.ProtectedRoute',
}

const ProtectedRouteProbe = (): ReactElement => {
    const { state } = useLocation();

    return <span data-testid={SignupProbeTestIds.ProtectedRoute}>{JSON.stringify(state)}</span>;
};

export type SignupDriver = {
    given: {
        theSignupSucceeds: () => void;
        theSignupHangs: () => void;
        theEmailIsTaken: () => void;
        theSignupFails: () => void;
        theRangeSays: (leak: { password: string; count: number }) => Promise<void>;
        theRangeIsCleanFor: (password: string) => Promise<void>;
        theRangeIsSlowToSay: (leak: { password: string; count: number }) => Promise<void>;
    };
    when: {
        created: () => Promise<void>;
        theSignupResponds: () => Promise<void>;
    };
    type: {
        email: (text: string) => Promise<void>;
        password: (text: string) => Promise<void>;
    };
    clear: { password: () => Promise<void> };
    click: {
        plan: (plan: Plan) => Promise<void>;
        submit: () => Promise<void>;
        submitTwice: () => Promise<void>;
    };
    assert: {
        stepsPosted: (name: FunnelEventName, count: number) => Promise<void>;
        signupSent: (expected: { email: string; plan: Plan; password: string; passwordWasPwned: boolean }) => void;
        signupsSent: (count: number) => void;
        protectedRouteIsShownFor: (plan: Plan) => Promise<void>;
        leakedWarningIsShown: () => Promise<void>;
        emailErrorIsShown: () => void;
        passwordErrorIsShown: () => void;
        serverMessageIsShown: (message: string) => Promise<void>;
        submitIsBusy: () => Promise<void>;
        submitIsOffered: () => void;
        failureWasLogged: () => void;
    };
};

export const makeSignupDriver = (): SignupDriver => {
    const user = userEvent.setup();
    let releaseSignup: (() => void) | undefined = undefined;
    const loggedErrors = vi.spyOn(logger, 'error').mockImplementation(() => {});

    respondToFunnelEvents();

    const signups = (): RecordedRequest[] =>
        fakeHttp.requests().filter((request) => request.method === HttpMethod.Post && request.path === SIGNUPS_PATH);

    const lastSignupBody = (): Record<string, unknown> => {
        const last = signups().at(-1);
        if (last === undefined) throw new Error('SignupDriver: no sign-up was sent');
        if (!isPlainObject(last.body))
            throw new Error(`SignupDriver: the sign-up body is not an object — ${String(last.body)}`);

        return last.body;
    };

    const respondToSignup = ({ status, body, gate }: { status: number; body: unknown; gate?: Promise<void> }): void => {
        const route = { method: HttpMethod.Post, path: SIGNUPS_PATH, status, body };
        fakeHttp.respond(gate === undefined ? route : { ...route, gate });
    };

    const submit = (): HTMLElement => screen.getByTestId(SignupTestIds.Submit);

    return {
        given: {
            theSignupSucceeds: (): void => {
                respondToSignup({ status: 201, body: A_CREATED_SIGNUP });
            },
            theSignupHangs: (): void => {
                respondToSignup({
                    status: 201,
                    body: A_CREATED_SIGNUP,
                    gate: new Promise<void>((resolve) => {
                        releaseSignup = resolve;
                    }),
                });
            },
            theEmailIsTaken: (): void => {
                respondToSignup({
                    status: HTTP_CONFLICT,
                    body: { error: 'create_signup: that email already has an account' },
                });
            },
            theSignupFails: (): void => {
                respondToSignup({ status: HTTP_SERVER_ERROR, body: { error: SERVER_ERROR_DETAIL } });
            },
            theRangeSays,
            theRangeIsCleanFor,
            theRangeIsSlowToSay: async (leak): Promise<void> => {
                await theRangeIsSlowToSay(leak);
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <FunnelProviders>
                            <Routes>
                                <Route path="/signup" element={<Signup />} />
                                <Route path={PROTECTED_ROUTE} element={<ProtectedRouteProbe />} />
                            </Routes>
                        </FunnelProviders>,
                        { route: '/signup' },
                    );
                });
            },
            theSignupResponds: async (): Promise<void> => {
                const release = releaseSignup;
                if (release === undefined) throw new Error('SignupDriver: no sign-up is waiting to be released');
                await act(async () => {
                    release();
                });
            },
        },
        type: {
            email: async (text: string): Promise<void> => {
                await user.type(screen.getByTestId(SignupTestIds.Email), text);
            },
            password: async (text: string): Promise<void> => {
                await user.type(screen.getByTestId(PasswordFieldTestIds.Input), text);
            },
        },
        clear: {
            password: async (): Promise<void> => {
                await user.clear(screen.getByTestId(PasswordFieldTestIds.Input));
            },
        },
        click: {
            plan: async (plan: Plan): Promise<void> => {
                await user.click(screen.getByLabelText(new RegExp(`^${planCardMap[plan].name}`)));
            },
            submit: async (): Promise<void> => {
                await user.click(submit());
            },
            submitTwice: async (): Promise<void> => {
                await user.dblClick(submit());
            },
        },
        assert: {
            stepsPosted: async (name: FunnelEventName, count: number): Promise<void> => {
                await waitFor(() => {
                    expect(postedSteps(name)).toHaveLength(count);
                });
            },
            signupSent: (expected): void => {
                expect(lastSignupBody()).toStrictEqual(expected);
            },
            signupsSent: (count: number): void => {
                expect(signups()).toHaveLength(count);
            },
            protectedRouteIsShownFor: async (plan: Plan): Promise<void> => {
                const state: ProtectedRouteState = { plan };
                await waitFor(() => {
                    expect(screen.getByTestId(SignupProbeTestIds.ProtectedRoute)).toHaveTextContent(
                        JSON.stringify(state),
                    );
                });
            },
            leakedWarningIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(PasswordFieldTestIds.Leaked)).toBeInTheDocument();
                });
            },
            emailErrorIsShown: (): void => {
                expect(screen.getByTestId(SignupTestIds.EmailError)).toBeInTheDocument();
            },
            passwordErrorIsShown: (): void => {
                expect(screen.getByTestId(PasswordFieldTestIds.Error)).toBeInTheDocument();
            },
            serverMessageIsShown: async (message: string): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(SignupTestIds.ServerMessage)).toHaveTextContent(message);
                });
                expect(screen.getByTestId(SignupTestIds.ServerMessage)).not.toHaveTextContent(SERVER_ERROR_DETAIL);
            },
            submitIsBusy: async (): Promise<void> => {
                await waitFor(() => {
                    expect(submit()).toHaveAttribute('aria-busy', 'true');
                });
                expect(submit()).toBeDisabled();
            },
            submitIsOffered: (): void => {
                expect(submit()).toBeEnabled();
            },
            failureWasLogged: (): void => {
                expect(loggedErrors).toHaveBeenCalledWith(
                    expect.stringContaining('handleSubmit'),
                    expect.objectContaining({ detail: SERVER_ERROR_DETAIL }),
                );
            },
        },
    };
};
