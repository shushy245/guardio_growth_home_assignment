// Model ↔ wire. The DTO types are the API's shape and live here.

import type { SignupCreatedModel, SignupModel } from '~/models/signup/model';

export type SignupCreateDTO = {
    email: string;
    plan: string;
    password: string;
    passwordWasPwned: boolean;
};

export type SignupCreatedDTO = {
    id: string;
    createdAt: string;
};

export const toCreatePayload = (signup: SignupModel): SignupCreateDTO => ({
    email: signup.email,
    plan: signup.plan,
    password: signup.password,
    passwordWasPwned: signup.passwordWasPwned,
});

export const createdFromDTO = (dto: SignupCreatedDTO): SignupCreatedModel => ({
    id: dto.id,
    createdAt: new Date(dto.createdAt),
});
