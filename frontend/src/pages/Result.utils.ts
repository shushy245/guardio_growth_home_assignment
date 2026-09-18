// The result page's testable surface: its test ids, the tone seam's class map, and the rule that
// decides whose copy the header carries. The component file exports only the component.

import { variantFor, type VisitorState } from '~/providers/VisitorProvider.utils';
import { RESULT_SCREEN_TONE_FLAG, Tone, type VariantConfigModel } from '~/models/featureFlag';

import styles from '~/pages/Result.module.scss';

// Where the CTA leads. The route table in App is the other reader of this path (S6 mounts it).
export const SIGNUP_ROUTE = '/signup';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum ResultTestIds {
    Page = 'ResultTestIds.Page',
    Headline = 'ResultTestIds.Headline',
    Subheadline = 'ResultTestIds.Subheadline',
    Cta = 'ResultTestIds.Cta',
    StickyBar = 'ResultTestIds.StickyBar',
}

// The tone seam's client half: the class an ancestor carries so that every tone-aware rule
// below it reads the variant's colours through `var(--tone-*)`. A lookup, never an if-chain —
// a third tone is a token set and a row here, not a branch in a component (Open/Closed).
// `string | undefined` is what a CSS module honestly promises — a class the stylesheet does not
// define reads as undefined — and Result.utils.test.ts is the check that none does.
export const toneClassMap: Record<Tone, string | undefined> = {
    [Tone.Calm]: styles.toneCalm,
    [Tone.Urgent]: styles.toneUrgent,
};

// What the header says when the visitor is outside the experiment: the flag is disabled and they
// were never assigned, or the visitor session failed and nothing about them is known. The funnel
// must not depend on the flag service being up, so this is the control experience, held here.
// It deliberately duplicates the seeded calm copy: the database one is product's to edit, this is
// what renders when product's cannot be read (ADR-0004).
export const CONTROL_COPY: VariantConfigModel = {
    headline: 'Known breaches',
    subheadline: "Here's the public record of data breaches.",
    ctaLabel: 'Protect me',
    tone: Tone.Calm,
};

// The copy this visitor sees. Their assigned variant's when they have one; the control copy
// otherwise — never a guess at a variant, and never a blank header while the session loads.
export const resolveResultCopy = (visitor: VisitorState): VariantConfigModel => {
    const variant = variantFor(visitor, RESULT_SCREEN_TONE_FLAG);
    if (variant === undefined) return CONTROL_COPY;

    return variant.config;
};
