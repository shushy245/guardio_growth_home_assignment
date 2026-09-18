import { describe, expect, it } from 'vitest';

import { aFunnelEvent } from '~/testkit/builders';
import { FunnelEventName, toCreatePayload } from '~/models/funnelEvent';

describe('funnelEvent.toCreatePayload', () => {
    it('sends the instant as an ISO string with its offset', () => {
        // The backend refuses a naive timestamp; `toISOString` always carries the `Z`.
        const payload = toCreatePayload(aFunnelEvent().occurringAt(new Date('2026-09-18T12:00:00.000Z')).build());

        expect(payload.occurredAt).toBe('2026-09-18T12:00:00.000Z');
    });

    it('sends the step name as its wire value', () => {
        const payload = toCreatePayload(aFunnelEvent().withName(FunnelEventName.ScanCompleted).build());

        expect(payload.name).toBe('scan_completed');
    });
});
