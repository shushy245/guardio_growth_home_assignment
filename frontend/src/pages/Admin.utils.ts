// The Admin page's testable surface: its test ids and the load state machine. The component file
// exports only the component. The flag editor's own surface lives in `FlagEditor.utils.ts`.

import { logger } from '~/logging/logger';
import { describeError } from '~/api/http-client';
import { fetchFeatureFlags } from '~/api/feature-flags';
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

// Operator copy, not the server's. A proxy's 502 and an axios wording are on-call detail: they
// go to the log, and what the page says is what the operator can act on.
export const LOAD_FAILED_MESSAGE =
    'The flags could not be loaded, so there is nothing to edit yet. Try again — the details are in the browser console.';

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
    // Failed carries nothing: the detail is logged, and what the page shows is fixed copy.
    | { status: LoadStatus.Failed };

export const isReady = (state: AdminState): state is Extract<AdminState, { status: LoadStatus.Ready }> =>
    state.status === LoadStatus.Ready;

export const isFailedToLoad = (state: AdminState): state is Extract<AdminState, { status: LoadStatus.Failed }> =>
    state.status === LoadStatus.Failed;

export const LOADING: AdminState = { status: LoadStatus.Loading };

// Answers with a state and never rejects, which is what `useLoadedState` asks of a loader: the
// page has one failure to show and the detail belongs in the log.
export const loadFlags = async (): Promise<AdminState> => {
    try {
        return { status: LoadStatus.Ready, flags: await fetchFeatureFlags() };
    } catch (error) {
        logger.error('loadFlags: the flag list could not be loaded', { detail: describeError(error) });

        return { status: LoadStatus.Failed };
    }
};
