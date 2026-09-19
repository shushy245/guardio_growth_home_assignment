// The plan picker's testable surface: its ids and the two cards' copy, as the design writes them.

import { Plan } from '~/models/signup';

export const planCardTestId = (plan: Plan): string => `PlanPickerTestIds.Card.${plan}`;

// The group's name for a screen reader; the page's headline is the visible one.
export const PLAN_GROUP_LABEL = 'Plan';

export type PlanCardModel = {
    name: string;
    price: string;
    features: readonly string[];
};

// One row per plan, read from, never branched on: a third plan is a row here and a wire value.
export const planCardMap: Record<Plan, PlanCardModel> = {
    [Plan.Basic]: {
        name: 'Basic',
        price: '$4.99/mo',
        features: ['One device protected', 'Breach monitoring'],
    },
    [Plan.Family]: {
        name: 'Family',
        price: '$9.99/mo',
        features: ['Up to 5 devices', 'Family breach alerts'],
    },
};

// The order the design lists them.
export const PLAN_ORDER: readonly Plan[] = [Plan.Basic, Plan.Family];
