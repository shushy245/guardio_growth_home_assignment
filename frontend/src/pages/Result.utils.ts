// The result page's testable surface. The component file exports only the component.

import { Tone } from '~/models/featureFlag';

import styles from '~/pages/Result.module.scss';

// The tone seam's client half: the class an ancestor carries so that every tone-aware rule
// below it reads the variant's colours through `var(--tone-*)`. A lookup, never an if-chain —
// a third tone is a token set and a row here, not a branch in a component (Open/Closed).
// `string | undefined` is what a CSS module honestly promises — a class the stylesheet does not
// define reads as undefined — and Result.utils.test.ts is the check that none does.
export const toneClassMap: Record<Tone, string | undefined> = {
    [Tone.Calm]: styles.toneCalm,
    [Tone.Urgent]: styles.toneUrgent,
};
