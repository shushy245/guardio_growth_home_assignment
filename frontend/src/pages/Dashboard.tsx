// The experiment dashboard: the hypothesis, the funnel by variant, the lift and the call, from
// one read of the results endpoint. Outside the funnel providers on purpose, like /admin: a
// product manager opening this page is not a visitor and must not be assigned to an arm.
import { type ReactElement, useEffect, useState } from 'react';

import { logger } from '~/logging/logger';
import { LiftCard } from '~/components/LiftCard';
import { FunnelBars } from '~/charts/FunnelBars';
import { Column, MainColumn, Row } from '~/ui/box';
import { ErrorState } from '~/components/ErrorState';
import { fetchExperimentResults } from '~/api/experiments';
import { HypothesisCard } from '~/components/HypothesisCard';
import { RESULT_SCREEN_TONE_FLAG } from '~/models/featureFlag';
import { describeError, isCancelled } from '~/api/http-client';
import type { ExperimentResultModel } from '~/models/experimentResult';
import { RecommendationBanner } from '~/components/RecommendationBanner';
import {
    DashboardTestIds,
    type DashboardState,
    EXPERIMENT_TITLE,
    isFailedToLoad,
    isReady,
    LOAD_FAILED_DESCRIPTION,
    LOAD_FAILED_TITLE,
    LoadStatus,
    RETRY_LABEL,
    toFunnelSeries,
} from '~/pages/Dashboard.utils';

import styles from '~/pages/Dashboard.module.scss';

export const Dashboard = (): ReactElement => {
    const [state, setState] = useState<DashboardState>({ status: LoadStatus.Loading });
    // Bumped by Retry: a failed load is not terminal.
    const [attempt, setAttempt] = useState(0);

    // The effect owns its controller and its cleanup aborts the fetch. Under StrictMode the first
    // mount's fetch is aborted by its cleanup and the second completes; axios turns an aborted
    // request into a CanceledError even when the answer had arrived, so the `isCancelled` return
    // is the whole of the protection against a state update after unmount (the shape of BF58).
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        setState({ status: LoadStatus.Loading });

        fetchExperimentResults({ flagKey: RESULT_SCREEN_TONE_FLAG, signal })
            .then((result) => {
                setState({ status: LoadStatus.Ready, result });
            })
            .catch((error: unknown) => {
                if (isCancelled(error)) return;
                logger.error('Dashboard: the experiment results could not be loaded', {
                    attempt,
                    detail: describeError(error),
                });
                setState({ status: LoadStatus.Failed });
            });

        return (): void => {
            controller.abort();
        };
    }, [attempt]);

    const handleRetry = (): void => {
        setAttempt((current) => current + 1);
    };

    return (
        <MainColumn className={styles.page} data-testid={DashboardTestIds.Page}>
            <h1 className={styles.title}>{EXPERIMENT_TITLE}</h1>
            <Body state={state} onRetry={handleRetry} />
        </MainColumn>
    );
};

const Body = ({ state, onRetry }: { state: DashboardState; onRetry: () => void }): ReactElement => {
    if (isFailedToLoad(state)) {
        return (
            <ErrorState
                title={LOAD_FAILED_TITLE}
                description={LOAD_FAILED_DESCRIPTION}
                retryLabel={RETRY_LABEL}
                onRetry={onRetry}
            />
        );
    }

    if (!isReady(state)) {
        return (
            <p className={styles.loading} role="status" data-testid={DashboardTestIds.Loading}>
                {`Loading experiment…`}
            </p>
        );
    }

    return <Cards result={state.result} />;
};

const Cards = ({ result }: { result: ExperimentResultModel }): ReactElement => (
    <Column className={styles.cards}>
        <HypothesisCard hypothesis={result.hypothesis} />
        <Row className={styles.pair}>
            <Column className={`${styles.card} ${styles.funnel}`}>
                <h2 className={styles.cardTitle}>{`Funnel by variant`}</h2>
                <FunnelBars series={toFunnelSeries(result)} />
            </Column>
            <Column className={`${styles.card} ${styles.lift}`}>
                <LiftCard result={result} />
                <RecommendationBanner result={result} />
            </Column>
        </Row>
    </Column>
);
