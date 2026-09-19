// The Dashboard page's testable surface: its route, its ids, the load state machine, and the
// pure step from the result to the chart's series. The component file exports only the component.

import { labelOfStep } from '~/shared/funnel-steps.utils';
import type { FunnelSeries } from '~/charts/FunnelBars.utils';
import type { ArmModel, ExperimentResultModel } from '~/models/experimentResult';

export const DASHBOARD_ROUTE = '/dashboard';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum DashboardTestIds {
    Page = 'DashboardTestIds.Page',
    Loading = 'DashboardTestIds.Loading',
}

export const EXPERIMENT_TITLE = 'Result screen tone test';

// Reader copy, not the server's. What failed is in the log; what the page says is what a reader
// can act on.
export const LOAD_FAILED_TITLE = "Couldn't load experiment data";
export const LOAD_FAILED_DESCRIPTION = 'The read did not arrive. Try again — the details are in the browser console.';
export const RETRY_LABEL = 'Retry';

export enum LoadStatus {
    Loading = 'loading',
    Ready = 'ready',
    Failed = 'failed',
}

// A discriminated union, so the result is only reachable once it has loaded.
export type DashboardState =
    | { status: LoadStatus.Loading }
    | { status: LoadStatus.Ready; result: ExperimentResultModel }
    | { status: LoadStatus.Failed };

export const isReady = (state: DashboardState): state is Extract<DashboardState, { status: LoadStatus.Ready }> =>
    state.status === LoadStatus.Ready;

export const isFailedToLoad = (
    state: DashboardState,
): state is Extract<DashboardState, { status: LoadStatus.Failed }> => state.status === LoadStatus.Failed;

const toSeries = (arm: ArmModel): FunnelSeries => ({
    key: arm.key,
    label: arm.key,
    steps: arm.steps.map((step) => ({ key: step.name, label: labelOfStep(step.name), value: step.visitors })),
});

// Control first, then the variant: the order the legend reads and the colours are assigned in.
export const toFunnelSeries = (result: ExperimentResultModel): FunnelSeries[] => [
    toSeries(result.control),
    toSeries(result.variant),
];
