// A fake HTTP transport behind the axios seam: an in-memory implementation of the network, not a
// mock with expectations. Tests describe routes in `given.*`, the app talks to `httpClient` as in
// production, and drivers assert on the requests the fake recorded.
//
// The second file allowed to import axios (the first is the seam itself): a transport has to
// speak axios's adapter contract, and building real AxiosErrors is what lets `statusOfError`
// stay the one place the app reads a failure.
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

import { httpClient } from '~/api/http-client';

export enum HttpMethod {
    Get = 'GET',
    Post = 'POST',
    Patch = 'PATCH',
}

export type RecordedRequest = {
    method: HttpMethod;
    path: string;
    body: unknown;
    headers: Record<string, string>;
};

type FakeRoute = {
    method: HttpMethod;
    path: string;
    status: number;
    body: unknown;
    // A route that answers only once this resolves — what a request in flight looks like, so a
    // test can act on the page while the server has not replied yet. The request is recorded
    // before the wait, so what was sent is assertable while it hangs.
    gate?: Promise<void>;
};

const NO_ROUTE_STATUS = 599;
const CLIENT_ERROR_FLOOR = 400;
const SERVER_ERROR_FLOOR = 500;

const isFailureStatus = (status: number): boolean => status >= CLIENT_ERROR_FLOOR;
const isServerFailure = (status: number): boolean => status >= SERVER_ERROR_FLOOR;

const methodOf = (config: InternalAxiosRequestConfig): HttpMethod => {
    const method = (config.method ?? 'get').toUpperCase();
    const known = Object.values(HttpMethod).find((member) => member === method);
    if (known === undefined) throw new Error(`fake-http: unsupported method ${method}`);

    return known;
};

const bodyOf = (config: InternalAxiosRequestConfig): unknown => {
    const { data } = config;
    if (typeof data === 'string') return JSON.parse(data);

    return data;
};

const headersOf = (config: InternalAxiosRequestConfig): Record<string, string> =>
    Object.fromEntries(
        Object.entries(config.headers.toJSON()).flatMap(([name, value]) =>
            typeof value === 'string' ? [[name, value]] : [],
        ),
    );

const toResponse = (route: FakeRoute, config: InternalAxiosRequestConfig): AxiosResponse => ({
    data: route.body,
    status: route.status,
    statusText: '',
    headers: {},
    config,
});

const toError = (response: AxiosResponse, config: InternalAxiosRequestConfig): AxiosError =>
    new AxiosError(
        `Request failed with status code ${response.status}`,
        isServerFailure(response.status) ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
        config,
        undefined,
        response,
    );

export type FakeHttp = {
    respond: (route: FakeRoute) => void;
    requests: () => RecordedRequest[];
    reset: () => void;
};

const routes: FakeRoute[] = [];
const requests: RecordedRequest[] = [];

// `findLast` would need lib ES2023 and the project targets ES2022, so the search walks the
// routes backwards by hand — last registration wins.
const lastRouteFor = ({ method, path }: { method: HttpMethod; path: string }): FakeRoute | undefined =>
    [...routes].reverse().find((candidate) => candidate.method === method && candidate.path === path);

// Later routes win over earlier ones for the same method and path, so a test can override a
// default the setup file registered.
httpClient.defaults.adapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const method = methodOf(config);
    const path = config.url ?? '';
    requests.push({ method, path, body: bodyOf(config), headers: headersOf(config) });

    const route = lastRouteFor({ method, path });
    if (route === undefined) {
        const missing = toResponse(
            { method, path, status: NO_ROUTE_STATUS, body: { error: `fake-http: no route for ${method} ${path}` } },
            config,
        );
        throw toError(missing, config);
    }

    if (route.gate !== undefined) await route.gate;

    const response = toResponse(route, config);
    if (isFailureStatus(route.status)) throw toError(response, config);

    return response;
};

// One fake per process, installed on the shared client at import; `reset()` empties it between
// tests so no route or recorded request leaks from one test into the next.
export const fakeHttp: FakeHttp = {
    respond: (route: FakeRoute): void => {
        routes.push(route);
    },
    requests: (): RecordedRequest[] => [...requests],
    reset: (): void => {
        routes.length = 0;
        requests.length = 0;
    },
};
