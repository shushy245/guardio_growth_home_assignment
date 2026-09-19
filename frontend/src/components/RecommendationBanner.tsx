// The design's RecommendationBanner: the call in one sentence, in the tone of the call, and the
// sample bar while the experiment is waiting for traffic. A native `progress`, so the fill is
// data with no inline style and a screen reader hears the two numbers.
import type { ReactElement } from 'react';

import { Column } from '~/ui/box';
import type { ExperimentResultModel } from '~/models/experimentResult';
import {
    bannerClassMap,
    formatBannerTitle,
    RecommendationBannerTestIds,
    showsSampleProgress,
} from '~/components/RecommendationBanner.utils';

import styles from '~/components/RecommendationBanner.module.scss';

export const RecommendationBanner = ({ result }: { result: ExperimentResultModel }): ReactElement => (
    <Column
        className={`${styles.banner} ${bannerClassMap[result.recommendation]}`}
        data-testid={RecommendationBannerTestIds.Root}
    >
        {/* Announced: the call is the one line a reader came for. */}
        <p className={styles.title} role="status">
            {formatBannerTitle(result)}
        </p>
        {showsSampleProgress(result) ? <SampleProgress result={result} /> : undefined}
    </Column>
);

const SampleProgress = ({ result }: { result: ExperimentResultModel }): ReactElement => (
    <progress
        className={styles.progress}
        value={result.sample.reachedPerArm}
        max={result.sample.requiredPerArm}
        aria-label={`Visitors per arm so far, of the sample required`}
        data-testid={RecommendationBannerTestIds.Progress}
    />
);
