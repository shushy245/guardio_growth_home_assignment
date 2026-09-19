import { httpClient } from '~/api/http-client';
// The experiment read. One endpoint, typed with the wire DTO and mapped through the model, so
// nothing past this file sees a raw results body. The signal is required for the same reason
// it is on the breach fetches: a fetch an effect can forget to abort is a state update after
// unmount waiting to happen.
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
