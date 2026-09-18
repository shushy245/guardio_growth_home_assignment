import { funnelEventModel } from '~/models';
// Funnel-event endpoint. The server answers 201 with nothing the client does not already know,
// so there is no body to translate back.
import { httpClient } from '~/api/http-client';
import type { FunnelEventModel } from '~/models/funnelEvent';

export const recordFunnelEvent = async (event: FunnelEventModel): Promise<void> => {
    await httpClient.post('/funnel-events', funnelEventModel.toCreatePayload(event));
};
