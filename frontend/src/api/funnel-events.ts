// Funnel-event endpoint. The server files the step under the visitor cookie and answers 201 with
// nothing the client does not already know, so there is no body to translate back.
//
// No signal: a step aborted on navigation is a step the experiment never counts. The
// convention for this directory is written out in `http-client.ts`.
import { funnelEventModel } from '~/models';
import { httpClient } from '~/api/http-client';
import type { FunnelEventModel } from '~/models/funnelEvent';

export const recordFunnelEvent = async (event: FunnelEventModel): Promise<void> => {
    await httpClient.post('/funnel-events', funnelEventModel.toCreatePayload(event));
};
