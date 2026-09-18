// The flag editor's testable surface: its test ids, the save state machine, and the operator copy
// a message assertion pins. The component file exports only the component.

import { CopyField, type FeatureFlagModel, hasCompleteSplit, WEIGHT_TOTAL } from '~/models/featureFlag';

export const HTTP_CONFLICT = 409;

export enum FlagField {
    Save = 'Save',
    SaveMessage = 'SaveMessage',
    Enabled = 'Enabled',
}

// The one field of a variant that is not copy. The copy fields come from `CopyField` in the
// model layer rather than a second list here, so the two cannot drift.
export const WEIGHT_FIELD = 'weight';

export type VariantField = CopyField | typeof WEIGHT_FIELD;

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the
// DOM is exactly what you grep for to find the code that renders it.
export const flagFieldTestId = ({ flagKey, field }: { flagKey: string; field: FlagField }): string =>
    `AdminTestIds.Flag.${flagKey}.${field}`;

export const variantFieldTestId = ({
    flagKey,
    variantKey,
    field,
}: {
    flagKey: string;
    variantKey: string;
    field: VariantField;
}): string => `AdminTestIds.Flag.${flagKey}.Variant.${variantKey}.${field}`;

export const copyLabelMap: Record<CopyField, string> = {
    [CopyField.Headline]: 'Headline',
    [CopyField.Subheadline]: 'Subheadline',
    [CopyField.CtaLabel]: 'Button label',
};

export enum SaveStatus {
    Idle = 'idle',
    Saving = 'saving',
    Saved = 'saved',
    Conflict = 'conflict',
    Failed = 'failed',
}

export type SaveState =
    | { status: SaveStatus.Idle }
    | { status: SaveStatus.Saving }
    | { status: SaveStatus.Saved }
    | { status: SaveStatus.Conflict }
    | { status: SaveStatus.Failed; error: string };

export const isSaving = (state: SaveState): boolean => state.status === SaveStatus.Saving;

export const isFailedSave = (state: SaveState): state is Extract<SaveState, { status: SaveStatus.Failed }> =>
    state.status === SaveStatus.Failed;

export const CONFLICT_MESSAGE =
    'This flag changed somewhere else while you were editing. Reload the page, then apply your change to the current version.';
export const SAVED_MESSAGE = 'Saved.';
export const MISSING_TOKEN_MESSAGE = 'Paste the admin token above before saving.';

// What the operator is told after a save attempt. A lookup table rather than a branch chain, so
// a new SaveStatus member is a compile error here instead of a silently blank message. Failed is
// not in it: it is the one state carrying its own text, and a guard reads it without the table
// having to re-check a status its own index already decided.
const saveMessageMap: Record<Exclude<SaveStatus, SaveStatus.Failed>, string | undefined> = {
    [SaveStatus.Idle]: undefined,
    [SaveStatus.Saving]: undefined,
    [SaveStatus.Saved]: SAVED_MESSAGE,
    [SaveStatus.Conflict]: CONFLICT_MESSAGE,
};

export const saveMessage = (state: SaveState): string | undefined => {
    if (isFailedSave(state)) return state.error;

    return saveMessageMap[state.status];
};

// Every condition the server would reject on, asked once, before the round trip: a request in
// flight (a second would race it), a split that does not cover every bucket (a 400), and no
// admin token to sign with (a 401).
export const canSave = ({
    save,
    flag,
    adminToken,
}: {
    save: SaveState;
    flag: FeatureFlagModel;
    adminToken: string;
}): boolean => !isSaving(save) && hasCompleteSplit(flag) && adminToken !== '';

// A disabled button that does not say why is the same dead end as no button. The split has its
// own note under the variants; the missing token has nowhere else to be said.
export const missingTokenHint = (adminToken: string): string | undefined =>
    adminToken === '' ? MISSING_TOKEN_MESSAGE : undefined;

// A weight is a share of one whole. The input is `type=number`, and a browser number input hands
// over whatever was typed — 999, or nothing at all — so the bound is applied here rather than
// trusted to the control.
export const clampWeight = (typed: string): number => {
    const weight = Number.parseInt(typed, 10);
    if (Number.isNaN(weight)) return 0;

    return Math.min(Math.max(weight, 0), WEIGHT_TOTAL);
};
