// Sign-up endpoint. The response carries only what the client cannot know — the id and the
// creation instant — and is mapped through the translator so nothing past here sees a raw body.
import { signupModel } from '~/models';
import { httpClient } from '~/api/http-client';
import type { SignupCreatedDTO, SignupCreatedModel, SignupModel } from '~/models/signup';

export const createSignup = async (signup: SignupModel): Promise<SignupCreatedModel> => {
    const response = await httpClient.post<SignupCreatedDTO>('/signups', signupModel.toCreatePayload(signup));

    return signupModel.createdFromDTO(response.data);
};
