// Everything about the visitor session that is not React: the state machine's shape, the one
// selector the pages read, and the load sequence (create or fetch, with the stale-id recovery).

import type { VisitorModel } from '~/models/visitor';
import { assignedVariantKey } from '~/models/visitor';
import { fetchFeatureFlags } from '~/api/feature-flags';
import { createVisitor, fetchVisitor } from '~/api/visitors';
import { findFlag, findVariant } from '~/models/featureFlag';
import { describeError, statusOfError } from '~/api/http-client';
import { readStoredVisitorId, storeVisitorId } from '~/storage/visitor-id';
import type { FeatureFlagModel, FeatureFlagVariantModel } from '~/models/featureFlag';

export enum VisitorStatus {
    Loading = 'loading',
    Ready = 'ready',
    Failed = 'failed',
}

export type VisitorSession = {
    visitor: VisitorModel;
    flags: FeatureFlagModel[];
};

// A discriminated union: a variant is only reachable through a ready session, so no page can
// read a default one while the request is in flight or after it failed.
export type VisitorState =
    | { status: VisitorStatus.Loading }
    | { status: VisitorStatus.Ready; session: VisitorSession }
    | { status: VisitorStatus.Failed; error: string };

export const isReady = (state: VisitorState): state is Extract<VisitorState, { status: VisitorStatus.Ready }> =>
    state.status === VisitorStatus.Ready;

export const isFailed = (state: VisitorState): state is Extract<VisitorState, { status: VisitorStatus.Failed }> =>
    state.status === VisitorStatus.Failed;

const HTTP_NOT_FOUND = 404;

const isNotFound = (error: unknown): boolean => statusOfError(error) === HTTP_NOT_FOUND;

// The variant this visitor was assigned for a flag, with its copy. Undefined while loading, after
// a failure, for a flag the visitor was not assigned to, or for a key nothing was assigned under —
// the caller decides what an unassigned visitor sees; this never invents an answer.
export const variantFor = (state: VisitorState, flagKey: string): FeatureFlagVariantModel | undefined => {
    if (!isReady(state)) return undefined;
    const flag = findFlag(state.session.flags, flagKey);
    if (flag === undefined) return undefined;
    const variantKey = assignedVariantKey(state.session.visitor, flagKey);
    if (variantKey === undefined) return undefined;

    return findVariant(flag, variantKey);
};

// A stored id the server no longer knows (the database was reset while the browser kept its
// mirror) is not an error: the visitor simply starts again with a new identity.
const resolveVisitor = async (storedId: string | undefined): Promise<VisitorModel> => {
    if (storedId === undefined) return createVisitor();
    try {
        return await fetchVisitor({ id: storedId });
    } catch (error) {
        if (isNotFound(error)) return createVisitor();
        throw error;
    }
};

export const loadVisitorSession = async (): Promise<VisitorState> => {
    try {
        const [visitor, flags] = await Promise.all([resolveVisitor(readStoredVisitorId()), fetchFeatureFlags()]);
        storeVisitorId(visitor.id);

        return { status: VisitorStatus.Ready, session: { visitor, flags } };
    } catch (error) {
        return { status: VisitorStatus.Failed, error: describeError(error) };
    }
};
