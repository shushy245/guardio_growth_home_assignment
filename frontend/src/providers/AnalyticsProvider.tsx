// Records funnel steps. Sits inside `VisitorProvider`: an event cannot be posted until the visitor
// is known, so steps recorded before that wait in order and go out the moment the session is
// ready. Pages talk to it through `useAnalytics` (the hook is the port, the provider the adapter).
import {
    createContext,
    type ReactElement,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react';

import { logger } from '~/logging/logger';
import { describeError } from '~/api/http-client';
import { generateUniqueId } from '~/shared/ids.utils';
import { recordFunnelEvent } from '~/api/funnel-events';
import { useVisitor } from '~/providers/VisitorProvider';
import { isFailed, isReady, type VisitorState } from '~/providers/VisitorProvider.utils';
import {
    type Analytics,
    hasWaitingEvents,
    type PendingEvent,
    toFunnelEvent,
    toPendingEvent,
    type TrackedEvent,
} from '~/providers/AnalyticsProvider.utils';

const AnalyticsContext = createContext<Analytics | undefined>(undefined);

export const AnalyticsProvider = ({ children }: { children: ReactNode }): ReactElement => {
    const visitor = useVisitor();
    // What `record` reads. Updated in the effect below, not during render: a child that mounts in
    // the commit that turns the session ready runs its own effect first and still sees the old
    // state here, so its step joins the queue behind the steps already waiting instead of jumping
    // ahead of them — the flush below then sends everything in the order it happened.
    const visitorRef = useRef<VisitorState>(visitor);
    const recorded = useRef(new Set<string>());
    const queue = useRef<PendingEvent[]>([]);

    const send = useCallback((pending: PendingEvent, visitorId: string): void => {
        recordFunnelEvent(toFunnelEvent({ pending, visitorId })).catch((error: unknown) => {
            logger.error('AnalyticsProvider.send: the event could not be recorded', {
                eventId: pending.id,
                name: pending.name,
                detail: describeError(error),
            });
        });
    }, []);

    const record = useCallback(
        (event: TrackedEvent): void => {
            if (recorded.current.has(event.id)) return;
            recorded.current.add(event.id);
            const pending = toPendingEvent({ event, now: new Date() });
            const state = visitorRef.current;
            if (isFailed(state)) {
                logger.error('AnalyticsProvider.record: dropping the event, there is no visitor session', {
                    eventId: pending.id,
                    name: pending.name,
                });

                return;
            }
            if (!isReady(state) || hasWaitingEvents(queue.current)) {
                queue.current = [...queue.current, pending];

                return;
            }
            send(pending, state.session.visitor.id);
        },
        [send],
    );

    useEffect(() => {
        visitorRef.current = visitor;
        const waiting = queue.current;
        if (!hasWaitingEvents(waiting)) return;
        if (isFailed(visitor)) {
            queue.current = [];
            logger.error('AnalyticsProvider: dropping queued events, the visitor session failed', {
                count: waiting.length,
                names: waiting.map((pending) => pending.name),
            });

            return;
        }
        if (!isReady(visitor)) return;
        queue.current = [];
        waiting.forEach((pending) => {
            send(pending, visitor.session.visitor.id);
        });
    }, [visitor, send]);

    const analytics = useMemo<Analytics>(
        () => ({
            record,
            track: (name): void => {
                record({ id: generateUniqueId('evt'), name });
            },
        }),
        [record],
    );

    return <AnalyticsContext.Provider value={analytics}>{children}</AnalyticsContext.Provider>;
};

export const useAnalytics = (): Analytics => {
    const analytics = useContext(AnalyticsContext);
    if (analytics === undefined) {
        throw new Error('useAnalytics: no AnalyticsProvider above this component — add it inside the funnel routes');
    }

    return analytics;
};
