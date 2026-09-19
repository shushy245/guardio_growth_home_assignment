// The confirmation page's testable surface: its ids and copy, the guard on the navigation state
// it is opened with, and the next steps per plan. The component file exports only the component.

import { Plan } from '~/models/signup';
import { isPlainObject } from '~/api/http-client.utils';
import { planCardMap } from '~/components/PlanPicker.utils';
import type { ProtectedRouteState } from '~/pages/Signup.utils';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum ProtectedTestIds {
    Page = 'ProtectedTestIds.Page',
    PlanLine = 'ProtectedTestIds.PlanLine',
    BackToResults = 'ProtectedTestIds.BackToResults',
}

export const PROTECTED_HEADLINE = "You're protected";
export const BACK_TO_RESULTS_LABEL = 'Back to results';

// The plan arrives as router state, which is `unknown` at the boundary: a direct visit to the
// page carries none, and a reload after a sign-up may or may not. A type predicate, not a cast.
export const isProtectedRouteState = (value: unknown): value is ProtectedRouteState =>
    isPlainObject(value) && Object.values(Plan).some((plan) => plan === value['plan']);

export const planLineFor = (plan: Plan): string =>
    `${planCardMap[plan].name} plan · ${planCardMap[plan].price} · demo only, nothing was charged`;

export type NextStepModel = {
    title: string;
    detail: string;
};

const INSTALL_STEP: NextStepModel = {
    title: 'Install the extension',
    detail: 'Real-time protection while you browse',
};

// The design shows the Family steps; the Basic second step is its one-device counterpart.
export const nextStepsMap: Record<Plan, readonly NextStepModel[]> = {
    [Plan.Basic]: [
        INSTALL_STEP,
        { title: 'Turn on breach alerts', detail: 'Hear first when your email shows up in a new leak' },
    ],
    [Plan.Family]: [INSTALL_STEP, { title: 'Add a family member', detail: '4 seats left on your plan' }],
};
