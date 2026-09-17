// The breach endpoints. Axios responses are typed with the wire DTO and mapped through the
// model's translator here, so no component ever parses a wire shape.
//
// `signal` is required, not optional: every caller of these is a React effect that can unmount
// mid-flight, and an optional abort is one that gets forgotten at exactly the call site where
// it mattered.

import { breachModel } from '~/models';
import { httpClient } from '~/api/http-client';
import { buildBreachesQuery } from '~/api/breaches.utils';
import type { BreachFilters, BreachPageModel, BreachSummaryModel } from '~/models/breach';

export const fetchBreaches = async (
    filters: BreachFilters,
    { signal }: { signal: AbortSignal },
): Promise<BreachPageModel> => {
    const { data } = await httpClient.get<breachModel.BreachPageDTO>(`/breaches${buildBreachesQuery(filters)}`, {
        signal,
    });

    return breachModel.pageFromDTO(data);
};

export const fetchBreachSummary = async ({ signal }: { signal: AbortSignal }): Promise<BreachSummaryModel> => {
    const { data } = await httpClient.get<breachModel.BreachSummaryDTO>('/breaches/summary', { signal });

    return breachModel.summaryFromDTO(data);
};
