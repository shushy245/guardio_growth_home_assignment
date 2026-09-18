import { featureFlagModel } from '~/models';
// Feature-flag endpoints. The write carries the admin token as a header — never in the URL,
// which lands in access logs, and never in the body, which the update schema would reject.
import { httpClient } from '~/api/http-client';
import type { FeatureFlagDTO, FeatureFlagModel, FeatureFlagUpdatedDTO } from '~/models/featureFlag';

export const ADMIN_TOKEN_HEADER = 'X-Admin-Token';

export const fetchFeatureFlags = async (): Promise<FeatureFlagModel[]> => {
    const response = await httpClient.get<FeatureFlagDTO[]>('/feature-flags');

    return response.data.map(featureFlagModel.fromDTO);
};

// Resolves to the new lock token — the one thing the client cannot know after a save.
export const updateFeatureFlag = async ({
    flag,
    adminToken,
}: {
    flag: FeatureFlagModel;
    adminToken: string;
}): Promise<string> => {
    const response = await httpClient.patch<FeatureFlagUpdatedDTO>(
        `/feature-flags/${encodeURIComponent(flag.key)}`,
        featureFlagModel.toUpdatePayload(flag),
        { headers: { [ADMIN_TOKEN_HEADER]: adminToken } },
    );

    return featureFlagModel.lockTokenFromDTO(response.data);
};
