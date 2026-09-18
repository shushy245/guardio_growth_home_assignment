// The funnel-event half of the fake network, shared by every driver whose subject records a step:
// the route that accepts them, and the read that finds the ones posted under a name.

import { isPlainObject } from '~/api/http-client.utils';
import type { FunnelEventName } from '~/models/funnelEvent';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';

const EVENTS_PATH = '/funnel-events';

// The default world: the server accepts every step. A scenario overrides it.
export const respondToFunnelEvents = (): void => {
    fakeHttp.respond({ method: HttpMethod.Post, path: EVENTS_PATH, status: 201, body: {} });
};

const nameOf = (request: RecordedRequest): unknown => (isPlainObject(request.body) ? request.body['name'] : undefined);

export const postedSteps = (name: FunnelEventName): RecordedRequest[] =>
    fakeHttp
        .requests()
        .filter((request) => request.method === HttpMethod.Post && request.path === EVENTS_PATH)
        .filter((request) => nameOf(request) === name);
