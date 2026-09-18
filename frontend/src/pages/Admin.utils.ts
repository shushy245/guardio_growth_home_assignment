// The Admin page's testable surface: test ids, the two state machines, and the copy that a
// message assertion pins. The component file exports only the component.

import type { CopyField, FeatureFlagModel } from '~/models/featureFlag';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the
// DOM is exactly what you grep for to find the code that renders it.
export enum AdminTestIds {
    Page = 'AdminTestIds.Page',
    Loading = 'AdminTestIds.Loading',
    LoadError = 'AdminTestIds.LoadError',
    AdminToken = 'AdminTestIds.AdminToken',
}

export enum FlagField {
    Save = 'Save',
    SaveMessage = 'SaveMessage',
    Enabled = 'Enabled',
}

// The one field of a variant that is not copy. The copy fields come from `CopyField` in the
// model layer rather than a second list here, so the two cannot drift.
export const WEIGHT_FIELD = 'weight';

export type VariantField = CopyField | typeof WEIGHT_FIELD;

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

export enum LoadStatus {
    Loading = 'loading',
    Ready = 'ready',
    Failed = 'failed',
}

// A discriminated union, so the flags are only reachable once they have loaded and no render
// can read an empty list as "there are no flags".
export type AdminState =
    | { status: LoadStatus.Loading }
    | { status: LoadStatus.Ready; flags: FeatureFlagModel[] }
    | { status: LoadStatus.Failed; error: string };

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

export const isReady = (state: AdminState): state is Extract<AdminState, { status: LoadStatus.Ready }> =>
    state.status === LoadStatus.Ready;

export const isFailedToLoad = (state: AdminState): state is Extract<AdminState, { status: LoadStatus.Failed }> =>
    state.status === LoadStatus.Failed;

export const isSaving = (state: SaveState): boolean => state.status === SaveStatus.Saving;

export const CONFLICT_MESSAGE =
    'This flag changed somewhere else while you were editing. Reload the page, then apply your change to the current version.';
export const SAVED_MESSAGE = 'Saved.';
export const MISSING_TOKEN_MESSAGE = 'Paste the admin token above before saving.';

// What the operator is told after a save attempt. A lookup table rather than a branch chain, so
// a new SaveStatus member is a compile error here instead of a silently blank message.
const saveMessageMap: Record<SaveStatus, (state: SaveState) => string | undefined> = {
    [SaveStatus.Idle]: () => undefined,
    [SaveStatus.Saving]: () => undefined,
    [SaveStatus.Saved]: () => SAVED_MESSAGE,
    [SaveStatus.Conflict]: () => CONFLICT_MESSAGE,
    [SaveStatus.Failed]: (state) => (state.status === SaveStatus.Failed ? state.error : undefined),
};

export const saveMessage = (state: SaveState): string | undefined => saveMessageMap[state.status](state);
