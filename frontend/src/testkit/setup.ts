import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

import { forgetVisitorId } from '~/storage/visitor-id';
import { fakeHttp, HttpMethod } from '~/testkit/fake-http';
import { aFeatureFlagDTO, aVisitorDTO } from '~/testkit/builders';

// Every test starts with an empty fake network and no remembered visitor. The defaults are the
// seeded world: a visitor can be created and the one flag is listed. A driver overrides what its
// scenario changes; a route nothing registered fails loudly rather than reaching a server.
beforeEach(() => {
    // jsdom has no layout engine and therefore no scrollIntoView. A no-op per test keeps a
    // component that scrolls from crashing every test that renders it; a driver that asserts on
    // the scroll replaces this with its own spy.
    Element.prototype.scrollIntoView = (): void => {};
    forgetVisitorId();
    fakeHttp.reset();
    fakeHttp.respond({ method: HttpMethod.Post, path: '/visitors', status: 201, body: aVisitorDTO().build() });
    fakeHttp.respond({
        method: HttpMethod.Get,
        path: '/feature-flags',
        status: 200,
        body: [aFeatureFlagDTO().build()],
    });
});

afterEach(() => {
    cleanup();
});
