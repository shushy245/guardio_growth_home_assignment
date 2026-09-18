// Builder for a funnel-event model: one step a visitor took.

import { type FunnelEventModel, FunnelEventName } from '~/models/funnelEvent';

const A_FUNNEL_EVENT: FunnelEventModel = {
    id: 'evt_3f9c2a1e-7b4d-4c8e-9a6f-1d2e3f4a5b6c',
    visitorId: 'vis_01K5G6X0000000000000000000',
    name: FunnelEventName.LandingView,
    occurredAt: new Date('2026-09-18T12:00:00.000Z'),
};

class FunnelEventBuilder {
    private state: FunnelEventModel = { ...A_FUNNEL_EVENT };

    withName(name: FunnelEventName): this {
        this.state = { ...this.state, name };

        return this;
    }

    occurringAt(occurredAt: Date): this {
        this.state = { ...this.state, occurredAt };

        return this;
    }

    build(): FunnelEventModel {
        return this.state;
    }
}

export const aFunnelEvent = (): FunnelEventBuilder => new FunnelEventBuilder();
