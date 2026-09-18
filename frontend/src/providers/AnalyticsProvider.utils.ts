// Everything about analytics that is not React: the port pages talk to, the shape of an event
// waiting for its visitor, and the two pure steps between a `track` call and the wire.

import type { FunnelEventModel, FunnelEventName } from '~/models/funnelEvent';

// A step with the id its caller minted. The id is the idempotency key: two calls carrying the
// same one are one event, which is what lets a mount effect run twice and post once.
export type TrackedEvent = {
    id: string;
    name: FunnelEventName;
};

// Stamped with its time at the `record` call, before the visitor is known, so a step that waited
// for the session still says when it actually happened.
export type PendingEvent = TrackedEvent & { occurredAt: Date };

export type Analytics = {
    // Idempotent on `id`: the caller owns the key. `useTrackOnce` is the mount-time caller.
    record: (event: TrackedEvent) => void;
    // A new event every call — an interaction happened again, so it is a new step.
    track: (name: FunnelEventName) => void;
};

export const hasWaitingEvents = (queue: PendingEvent[]): boolean => queue.length > 0;

export const toPendingEvent = ({ event, now }: { event: TrackedEvent; now: Date }): PendingEvent => ({
    ...event,
    occurredAt: now,
});

export const toFunnelEvent = ({
    pending,
    visitorId,
}: {
    pending: PendingEvent;
    visitorId: string;
}): FunnelEventModel => ({
    id: pending.id,
    visitorId,
    name: pending.name,
    occurredAt: pending.occurredAt,
});
