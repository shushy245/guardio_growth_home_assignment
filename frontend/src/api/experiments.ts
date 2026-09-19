import { httpClient } from '~/api/http-client';
// The experiment read. One endpoint, typed with the wire DTO and mapped through the model, so
// nothing past this file sees a raw results body. The read answers a flag key and is refetched
// on Retry, so it takes a required signal — the convention is in `http-client.ts`.
import { experimentResultModel } from '~/models';
import type { ExperimentResultDTO, ExperimentResultModel } from '~/models/experimentResult';

export const fetchExperimentResults = async ({
    flagKey,
    signal,
}: {
    flagKey: string;
    signal: AbortSignal;
}): Promise<ExperimentResultModel> => {
    const response = await httpClient.get<ExperimentResultDTO>(`/experiments/${encodeURIComponent(flagKey)}/results`, {
        signal,
    });

    return experimentResultModel.fromDTO(response.data);
};
