// The hypothesis card's testable surface. The component file exports only the component.

import { formatShare } from '~/shared/format.utils';
import type { HypothesisModel } from '~/models/experimentResult';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum HypothesisCardTestIds {
    Root = 'HypothesisCardTestIds.Root',
    Statement = 'HypothesisCardTestIds.Statement',
}

// `Baseline 8% · powered to detect a +20% relative lift`: the two numbers the required sample
// was computed from, so a reader can see what the finish line rests on.
export const formatHypothesisMeta = (hypothesis: HypothesisModel): string =>
    `Baseline ${formatShare(hypothesis.baselineRate)} · powered to detect a +${formatShare(hypothesis.minimumDetectableRelativeLift)} relative lift`;
