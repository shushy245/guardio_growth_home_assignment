// Breach endpoints. Responses are typed with the wire DTO and mapped through the model
// translator, so nothing past this file sees a raw body.
//
// Both reads answer changing inputs, so both take a required signal — the directory's convention
// is written out once in `http-client.ts`.
import { breachModel } from '~/models';
import { httpClient } from '~/api/http-client';
import { buildBreachesQuery } from '~/api/breaches.utils';
import type {
    BreachFilters,
    BreachPageDTO,
    BreachPageModel,
    BreachSummaryDTO,
    BreachSummaryModel,
} from '~/models/breach';

export const fetchBreaches = async ({
    filters,
    signal,
}: {
    filters: BreachFilters;
    signal: AbortSignal;
}): Promise<BreachPageModel> => {
    const response = await httpClient.get<BreachPageDTO>(`/breaches${buildBreachesQuery(filters)}`, { signal });

    return breachModel.pageFromDTO(response.data);
};

export const fetchBreachSummary = async ({ signal }: { signal: AbortSignal }): Promise<BreachSummaryModel> => {
    const response = await httpClient.get<BreachSummaryDTO>('/breaches/summary', { signal });

    return breachModel.summaryFromDTO(response.data);
};
