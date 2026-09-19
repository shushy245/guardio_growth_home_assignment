// The design's HypothesisCard: the label, the statement in prose, and the two figures the
// experiment's finish line was computed from.
import type { ReactElement } from 'react';

import { Column } from '~/ui/box';
import type { HypothesisModel } from '~/models/experimentResult';
import { formatHypothesisMeta, HypothesisCardTestIds } from '~/components/HypothesisCard.utils';

import styles from '~/components/HypothesisCard.module.scss';

export const HypothesisCard = ({ hypothesis }: { hypothesis: HypothesisModel }): ReactElement => (
    <Column className={styles.card} data-testid={HypothesisCardTestIds.Root}>
        <h2 className={styles.label}>{`Hypothesis`}</h2>
        <p className={styles.statement} data-testid={HypothesisCardTestIds.Statement}>
            {hypothesis.statement}
        </p>
        <p className={styles.meta}>{formatHypothesisMeta(hypothesis)}</p>
    </Column>
);
