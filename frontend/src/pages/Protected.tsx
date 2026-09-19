// The confirmation, the design's S-5: a check, the plan that was chosen, two next steps, and a
// way back to the results. One centred column at every width; the card keeps its measure at
// 768+ so it never becomes a wide slab. The plan arrives as navigation state from the sign-up;
// a visit carrying none has nothing to confirm and is sent back to the sign-up, recording nothing.
// The state survives a reload (the router keeps it on the history entry) but not a link opened in
// a new tab — a mock sign-up has no account page to return to (ADR-0004 amendment).
import type { ReactElement } from 'react';
import { Link, Navigate, useLocation } from 'react-router';

import { Column } from '~/ui/box';
import { Plan } from '~/models/signup';
import { RESULT_ROUTE } from '~/pages/Scan.utils';
import { SIGNUP_ROUTE } from '~/pages/Result.utils';
import { useTrackOnce } from '~/hooks/useTrackOnce';
import { FunnelEventName } from '~/models/funnelEvent';
import {
    BACK_TO_RESULTS_LABEL,
    isProtectedRouteState,
    nextStepsMap,
    planLineFor,
    PROTECTED_HEADLINE,
    ProtectedTestIds,
} from '~/pages/Protected.utils';

import styles from '~/pages/Protected.module.scss';

export const Protected = (): ReactElement => {
    const { state } = useLocation();
    if (!isProtectedRouteState(state)) return <Navigate to={SIGNUP_ROUTE} replace />;

    return <Confirmation plan={state.plan} />;
};

// Its own component so the activation step is recorded only once there is a sign-up to confirm:
// a hook cannot sit behind the guard above.
const Confirmation = ({ plan }: { plan: Plan }): ReactElement => {
    useTrackOnce(FunnelEventName.Activation);

    return (
        <main className={styles.page} data-testid={ProtectedTestIds.Page}>
            <Column className={styles.card}>
                <span className={styles.check} aria-hidden="true">{`✓`}</span>
                <h1 className={styles.headline}>{PROTECTED_HEADLINE}</h1>
                <p className={styles.planLine} data-testid={ProtectedTestIds.PlanLine}>
                    {planLineFor(plan)}
                </p>
                <ol className={styles.steps} data-testid={ProtectedTestIds.Steps}>
                    {nextStepsMap[plan].map((step, index) => (
                        <li key={step.title} className={styles.step}>
                            <span className={styles.stepNumber} aria-hidden="true">
                                {index + 1}
                            </span>
                            <Column className={styles.stepText}>
                                <span className={styles.stepTitle}>{step.title}</span>
                                <span className={styles.stepDetail}>{step.detail}</span>
                            </Column>
                        </li>
                    ))}
                </ol>
                <Link className={styles.back} to={RESULT_ROUTE} data-testid={ProtectedTestIds.BackToResults}>
                    {BACK_TO_RESULTS_LABEL}
                </Link>
            </Column>
        </main>
    );
};
