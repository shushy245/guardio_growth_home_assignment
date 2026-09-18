// The Admin page's testable surface: its test ids and the load state machine. The component file
// exports only the component. The flag editor's own surface lives in `FlagEditor.utils.ts`.

import type { FeatureFlagModel } from '~/models/featureFlag';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the
// DOM is exactly what you grep for to find the code that renders it.
export enum AdminTestIds {
    Page = 'AdminTestIds.Page',
    Loading = 'AdminTestIds.Loading',
    LoadError = 'AdminTestIds.LoadError',
    AdminToken = 'AdminTestIds.AdminToken',
    Retry = 'AdminTestIds.Retry',
}

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

export const isReady = (state: AdminState): state is Extract<AdminState, { status: LoadStatus.Ready }> =>
    state.status === LoadStatus.Ready;

export const isFailedToLoad = (state: AdminState): state is Extract<AdminState, { status: LoadStatus.Failed }> =>
    state.status === LoadStatus.Failed;
