// The design's PlanCard, twice, as one radio group: exactly one plan is chosen and the whole
// card is the target. The radio is real — keyboard, screen reader and form semantics for free —
// and the design's ring is drawn beside it in CSS, so a card is a label around an input.
import type { ChangeEvent, ReactElement } from 'react';

import { Plan } from '~/models/signup';
import { joinClassNames } from '~/ui/box.utils';
import { PLAN_GROUP_LABEL, PLAN_ORDER, planCardMap, planCardTestId } from '~/components/PlanPicker.utils';

import styles from '~/components/PlanPicker.module.scss';

export const PlanPicker = ({ value, onChange }: { value: Plan; onChange: (plan: Plan) => void }): ReactElement => (
    <fieldset className={styles.group}>
        <legend className={styles.legend}>{PLAN_GROUP_LABEL}</legend>
        {PLAN_ORDER.map((plan) => (
            <PlanCard key={plan} plan={plan} isSelected={plan === value} onSelect={onChange} />
        ))}
    </fieldset>
);

const PlanCard = ({
    plan,
    isSelected,
    onSelect,
}: {
    plan: Plan;
    isSelected: boolean;
    onSelect: (plan: Plan) => void;
}): ReactElement => {
    const card = planCardMap[plan];

    const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
        if (!event.target.checked) return;
        onSelect(plan);
    };

    return (
        <label className={joinClassNames(styles.card, isSelected ? styles.cardSelected : undefined)}>
            <span className={styles.heading}>
                <span className={styles.name}>{card.name}</span>
                <input
                    className={styles.radio}
                    type="radio"
                    name="plan"
                    value={plan}
                    checked={isSelected}
                    data-testid={planCardTestId(plan)}
                    onChange={handleChange}
                />
            </span>
            <span className={styles.price}>{card.price}</span>
            <span className={styles.features}>
                {card.features.map((feature) => (
                    <span key={feature}>{feature}</span>
                ))}
            </span>
        </label>
    );
};
