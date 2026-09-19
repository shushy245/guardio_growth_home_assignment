import { expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act, type ReactElement, useState } from 'react';

import { Plan } from '~/models/signup';
import { PlanPicker } from '~/components/PlanPicker';
import { planCardTestId } from '~/components/PlanPicker.utils';
import { renderWithProviders } from '~/testkit/renderWithProviders';

// A test-only parent that holds the choice the way the sign-up page does.
const PlanPickerHost = ({
    initialPlan,
    onChange,
}: {
    initialPlan: Plan;
    onChange: (plan: Plan) => void;
}): ReactElement => {
    const [plan, setPlan] = useState(initialPlan);

    const handleChange = (next: Plan): void => {
        onChange(next);
        setPlan(next);
    };

    return <PlanPicker value={plan} onChange={handleChange} />;
};

export type PlanPickerDriver = {
    given: { theCurrentPlan: (plan: Plan) => void };
    when: { created: () => Promise<void> };
    click: { plan: (plan: Plan) => Promise<void> };
    assert: {
        selectedPlanIs: (plan: Plan) => void;
        changedTo: (...plans: Plan[]) => void;
        bothPlansAreOffered: () => void;
    };
};

export const makePlanPickerDriver = (): PlanPickerDriver => {
    const user = userEvent.setup();
    const onChange = vi.fn<(plan: Plan) => void>();
    let initialPlan = Plan.Family;

    const radioFor = (plan: Plan): HTMLInputElement => {
        const element = screen.getByTestId(planCardTestId(plan));
        if (!(element instanceof HTMLInputElement)) throw new Error('PlanPickerDriver: the plan card is not a radio');

        return element;
    };

    return {
        given: {
            theCurrentPlan: (plan: Plan): void => {
                initialPlan = plan;
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(<PlanPickerHost initialPlan={initialPlan} onChange={onChange} />);
                });
            },
        },
        click: {
            // What someone actually taps: the card's name, not the radio inside it.
            plan: async (plan: Plan): Promise<void> => {
                await user.click(screen.getByLabelText(new RegExp(`^${plan === Plan.Basic ? 'Basic' : 'Family'}`)));
            },
        },
        assert: {
            // Exactly one: the chosen plan is checked and the other is not.
            selectedPlanIs: (plan: Plan): void => {
                Object.values(Plan).forEach((candidate) => {
                    expect(radioFor(candidate).checked).toBe(candidate === plan);
                });
            },
            changedTo: (...plans: Plan[]): void => {
                expect(onChange.mock.calls.map(([plan]) => plan)).toStrictEqual(plans);
            },
            bothPlansAreOffered: (): void => {
                expect(screen.getAllByRole('radio')).toHaveLength(Object.values(Plan).length);
            },
        },
    };
};
