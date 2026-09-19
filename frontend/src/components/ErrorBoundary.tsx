// The last thing between a render-time throw and a blank document. Without it React unmounts
// the whole tree on any uncaught throw — a hook used outside its provider, a chart handed a
// series it has no colour for — and the visitor is left on a white page with nothing to click
// and no idea anything failed (BF69).
//
// A class, which nothing else here is: `getDerivedStateFromError` and `componentDidCatch` have
// no hook equivalent, so this is React's API rather than a house choice.
import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react';

import { logger } from '~/logging/logger';
import { ErrorState } from '~/components/ErrorState';
import { ErrorStateKind } from '~/components/ErrorState.utils';
import {
    type ErrorBoundaryState,
    FAILED,
    NOT_FAILED,
    RENDER_FAILURE_ACTION_LABEL,
    RENDER_FAILURE_DESCRIPTION,
    RENDER_FAILURE_TITLE,
} from '~/components/ErrorBoundary.utils';

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
    public override state: ErrorBoundaryState = NOT_FAILED;

    public static getDerivedStateFromError(): ErrorBoundaryState {
        return FAILED;
    }

    public override componentDidCatch(error: Error, info: ErrorInfo): void {
        logger.error('ErrorBoundary: a render threw and the tree below it was unmounted', {
            detail: error.message,
            componentStack: info.componentStack,
        });
    }

    public override render(): ReactNode {
        if (!this.state.hasFailed) return this.props.children;

        return <RenderFailure />;
    }
}

// The tree that threw is the one React just unmounted, so re-rendering it is not on offer: a
// fresh document is the only honest way out, and the visitor is told that is what the button does.
// `Page`, not `Panel`: whatever heading the screen had went with the tree, so this title is the
// document's only one.
const RenderFailure = (): ReactElement => {
    const handleReload = (): void => {
        window.location.reload();
    };

    return (
        <ErrorState
            title={RENDER_FAILURE_TITLE}
            description={RENDER_FAILURE_DESCRIPTION}
            retryLabel={RENDER_FAILURE_ACTION_LABEL}
            kind={ErrorStateKind.Page}
            onRetry={handleReload}
        />
    );
};
