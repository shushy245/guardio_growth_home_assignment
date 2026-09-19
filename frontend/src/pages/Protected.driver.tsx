import { act } from 'react';
import { expect } from 'vitest';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { screen, waitFor, within } from '@testing-library/react';

import { Plan } from '~/models/signup';
import { Protected } from '~/pages/Protected';
import { RESULT_ROUTE } from '~/pages/Scan.utils';
import { SIGNUP_ROUTE } from '~/pages/Result.utils';
import { FunnelEventName } from '~/models/funnelEvent';
import { ProtectedTestIds } from '~/pages/Protected.utils';
import { FunnelProviders } from '~/providers/FunnelProviders';
import { postedSteps, respondToFunnelEvents } from '~/testkit/funnel-events';
import { RenderMode, renderWithProviders } from '~/testkit/renderWithProviders';
import { PROTECTED_ROUTE, type ProtectedRouteState } from '~/pages/Signup.utils';

// Where a visit with nothing to confirm is sent. A probe, not the real Signup page.
export enum ProtectedProbeTestIds {
    SignupRoute = 'ProtectedProbeTestIds.SignupRoute',
}

const SignupRouteProbe = (): ReactElement => <span data-testid={ProtectedProbeTestIds.SignupRoute}>{`signup`}</span>;

export type ProtectedDriver = {
    given: { aSignupFor: (plan: Plan) => void };
    when: { created: () => Promise<void> };
    assert: {
        confirmationIsShownFor: (plan: Plan) => void;
        backToResultsLeadsToTheResultScreen: () => void;
        nextStepsRead: (titles: string[]) => void;
        stepsPosted: (name: FunnelEventName, count: number) => Promise<void>;
        noStepPosted: (name: FunnelEventName) => void;
        signupRouteIsShown: () => void;
    };
};

export const makeProtectedDriver = (): ProtectedDriver => {
    let state: ProtectedRouteState | undefined = undefined;
    respondToFunnelEvents();

    return {
        given: {
            aSignupFor: (plan: Plan): void => {
                state = { plan };
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(
                        <FunnelProviders>
                            <Routes>
                                <Route path={PROTECTED_ROUTE} element={<Protected />} />
                                <Route path={SIGNUP_ROUTE} element={<SignupRouteProbe />} />
                            </Routes>
                        </FunnelProviders>,
                        // What production ships: the mount effect runs, cleans up and runs again.
                        { route: PROTECTED_ROUTE, state, mode: RenderMode.Strict },
                    );
                });
            },
        },
        assert: {
            confirmationIsShownFor: (plan: Plan): void => {
                expect(screen.getByTestId(ProtectedTestIds.Page)).toBeInTheDocument();
                expect(screen.getByTestId(ProtectedTestIds.PlanLine)).toHaveTextContent(
                    plan === Plan.Family ? 'Family plan' : 'Basic plan',
                );
            },
            // The steps differ by plan and the Basic pair is the page's one departure from the
            // design (deviation 12), so the plan line alone left the choice unpinned: swapping
            // the Family steps onto the Basic page passed (BF82).
            nextStepsRead: (titles: string[]): void => {
                const steps = within(screen.getByTestId(ProtectedTestIds.Steps)).getAllByRole('listitem');
                expect(steps).toHaveLength(titles.length);
                titles.forEach((title, index) => {
                    expect(steps[index]).toHaveTextContent(title);
                });
            },
            backToResultsLeadsToTheResultScreen: (): void => {
                expect(screen.getByTestId(ProtectedTestIds.BackToResults)).toHaveAttribute('href', RESULT_ROUTE);
            },
            stepsPosted: async (name: FunnelEventName, count: number): Promise<void> => {
                await waitFor(() => {
                    expect(postedSteps(name)).toHaveLength(count);
                });
            },
            // Synchronous on purpose: an absence inside `waitFor` is true on its first look.
            noStepPosted: (name: FunnelEventName): void => {
                expect(postedSteps(name)).toHaveLength(0);
            },
            signupRouteIsShown: (): void => {
                expect(screen.getByTestId(ProtectedProbeTestIds.SignupRoute)).toBeInTheDocument();
            },
        },
    };
};
