// The design's RecommendationBanner: the call in one sentence, in the tone of the call, and the
// sample bar while the experiment is waiting for traffic. A native `progress`, so the fill is
// data with no inline style and a screen reader hears the two numbers.
import type { ReactElement } from 'react';

import { Column } from '~/ui/box';
import { joinClassNames } from '~/ui/box.utils';
import type { ExperimentResultModel } from '~/models/experimentResult';
import {
    BannerClass,
    bannerClassMap,
    formatBannerTitle,
    RecommendationBannerTestIds,
    showsSampleProgress,
} from '~/components/RecommendationBanner.utils';

import styles from '~/components/RecommendationBanner.module.scss';

// Through the module, never the raw name: in production the class is hashed, and a raw `wait`
// matches no rule. Vitest compiles modules non-scoped, so no jsdom test can tell the two apart —
// the S7 visual pass measured the banner grey and found it (V9).
const toneClassMap: Record<BannerClass, string | undefined> = {
    [BannerClass.Ship]: styles.ship,
    [BannerClass.Stop]: styles.stop,
    [BannerClass.Wait]: styles.wait,
};

export const RecommendationBanner = ({ result }: { result: ExperimentResultModel }): ReactElement => (
    <Column
        className={joinClassNames(styles.banner, toneClassMap[bannerClassMap[result.recommendation]])}
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
