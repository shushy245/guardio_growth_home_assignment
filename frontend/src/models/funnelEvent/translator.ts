// Model → wire. The DTO type is the API's shape and lives here.

import type { FunnelEventModel } from '~/models/funnelEvent/model';

export type FunnelEventCreateDTO = {
    id: string;
    visitorId: string;
    name: string;
    occurredAt: string;
};

export const toCreatePayload = (event: FunnelEventModel): FunnelEventCreateDTO => ({
    id: event.id,
    visitorId: event.visitorId,
    name: event.name,
    occurredAt: event.occurredAt.toISOString(),
});
