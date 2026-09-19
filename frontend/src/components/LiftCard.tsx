// The design's LiftCard: the relative lift as the headline figure, its interval and p-value on
// the line beneath. The colour of the figure carries direction; the words carry it too.
import type { ReactElement } from 'react';

import { Column } from '~/ui/box';
import { joinClassNames } from '~/ui/box.utils';
import type { ExperimentResultModel } from '~/models/experimentResult';
import {
    formatLiftTitle,
    isMeasured,
    LiftCardTestIds,
    LiftDirection,
    NO_DATA_LINE,
    NO_DATA_VALUE,
    readLift,
} from '~/components/LiftCard.utils';

import styles from '~/components/LiftCard.module.scss';

const directionClassMap: Record<LiftDirection, string | undefined> = {
    [LiftDirection.Up]: styles.up,
    [LiftDirection.Down]: styles.down,
    [LiftDirection.Flat]: styles.flat,
};

export const LiftCard = ({ result }: { result: ExperimentResultModel }): ReactElement => {
    const read = readLift(result);

    return (
        <Column className={styles.lift} data-testid={LiftCardTestIds.Root}>
            <h2 className={styles.title}>{formatLiftTitle(result)}</h2>
            {isMeasured(read) ? (
                <>
                    <span
                        className={joinClassNames(styles.value, directionClassMap[read.direction])}
                        data-testid={LiftCardTestIds.Value}
                    >
                        {read.value}
                    </span>
                    <span className={styles.interval} data-testid={LiftCardTestIds.Interval}>
                        {read.line}
                    </span>
                </>
            ) : (
                <>
                    <span className={joinClassNames(styles.value, styles.flat)} data-testid={LiftCardTestIds.Value}>
                        {NO_DATA_VALUE}
                    </span>
                    <span className={styles.interval} data-testid={LiftCardTestIds.Interval}>
                        {NO_DATA_LINE}
                    </span>
                </>
            )}
        </Column>
    );
};
