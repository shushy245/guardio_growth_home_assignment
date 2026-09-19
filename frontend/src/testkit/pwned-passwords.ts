// The range half of the fake network, shared by every driver whose subject runs the leak check:
// what the proxy answers for the password a scenario names. The prefix is derived with the same
// hash the field uses, so a scenario says "this password is leaked" and never spells a hash.

import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { sha1Hex, splitHash } from '~/components/PasswordField.utils';

export const RANGE_PATH = '/pwned-passwords/range';
const HTTP_SERVICE_UNAVAILABLE = 503;
// A padding line the range API adds under `Add-Padding`: a suffix seen zero times.
export const A_PADDING_LINE = '0018A45C4D1DEF81644B54AB7F969B88D65:0';

const respondForPassword = async ({
    password,
    text,
    gate,
}: {
    password: string;
    text: string;
    gate?: Promise<void> | undefined;
}): Promise<void> => {
    const { prefix } = splitHash(await sha1Hex(password));
    const route = { method: HttpMethod.Get, path: `${RANGE_PATH}/${prefix}`, status: 200, body: text };
    fakeHttp.respond(gate === undefined ? route : { ...route, gate });
};

const leakedText = async ({ password, count }: { password: string; count: number }): Promise<string> => {
    const { suffix } = splitHash(await sha1Hex(password));

    return [A_PADDING_LINE, `${suffix}:${count}`].join('\r\n');
};

export const theRangeSays = async ({ password, count }: { password: string; count: number }): Promise<void> => {
    await respondForPassword({ password, text: await leakedText({ password, count }) });
};

export const theRangeIsCleanFor = async (password: string): Promise<void> => {
    await respondForPassword({ password, text: A_PADDING_LINE });
};

// Answers only once the returned release is called — a range still on its way.
export const theRangeIsSlowToSay = async ({
    password,
    count,
}: {
    password: string;
    count: number;
}): Promise<() => void> => {
    let release: () => void = (): void => {};
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await respondForPassword({ password, text: await leakedText({ password, count }), gate });

    return release;
};

export const PROXY_FAILURE_DETAIL = 'get_pwned_password_range: the password-leak source is unavailable';

// The proxy answers this password's prefix with its 503 — registered per prefix, because the
// fake matches a path exactly and a route on the bare range path would never be asked.
export const theProxyFailsFor = async (password: string): Promise<void> => {
    const { prefix } = splitHash(await sha1Hex(password));
    fakeHttp.respond({
        method: HttpMethod.Get,
        path: `${RANGE_PATH}/${prefix}`,
        status: HTTP_SERVICE_UNAVAILABLE,
        body: { error: PROXY_FAILURE_DETAIL },
    });
};

export const rangePathsRequested = (): string[] =>
    fakeHttp
        .requests()
        .filter((request) => request.method === HttpMethod.Get && request.path.startsWith(`${RANGE_PATH}/`))
        .map((request) => request.path);

// The range requests that were abandoned by aborting their signal — the observable half of
// "the visitor typed on before this answered", which no rendered state can show.
export const rangeRequestsAbandoned = (): string[] =>
    fakeHttp
        .requests()
        .filter(
            (request) =>
                request.method === HttpMethod.Get && request.path.startsWith(`${RANGE_PATH}/`) && request.isAborted(),
        )
        .map((request) => request.path);
