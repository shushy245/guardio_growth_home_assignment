import { act } from 'react';
import { expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import { Admin } from '~/pages/Admin';
import { CopyField } from '~/models/featureFlag';
import { isPlainObject } from '~/api/http-client.utils';
import { ADMIN_TOKEN_HEADER } from '~/api/feature-flags';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';
import type { FeatureFlagDTO, FeatureFlagUpdatePayload } from '~/models/featureFlag';
import { AdminTestIds, flagFieldTestId, FlagField, variantFieldTestId, WEIGHT_FIELD } from '~/pages/Admin.utils';

const RESULT_SCREEN_TONE = 'result_screen_tone';
const URGENT = 'urgent';
const SAVE_PATH = `/feature-flags/${RESULT_SCREEN_TONE}`;
const HTTP_CONFLICT = 409;
const HTTP_SERVER_ERROR = 500;

const urgentFieldId = (field: CopyField | typeof WEIGHT_FIELD): string =>
    variantFieldTestId({ flagKey: RESULT_SCREEN_TONE, variantKey: URGENT, field });

export type AdminDriver = {
    given: {
        theServerListsFlags: (...flags: FeatureFlagDTO[]) => void;
        theFlagListFails: () => void;
        theSaveSucceedsWithToken: (token: string) => void;
        theSaveConflicts: () => void;
        theSaveFails: () => void;
    };
    when: { created: () => Promise<void> };
    type: {
        adminToken: (token: string) => Promise<void>;
        urgentCtaLabel: (label: string) => Promise<void>;
        urgentWeight: (weight: string) => Promise<void>;
    };
    click: { save: () => Promise<void> };
    assert: {
        saveCarried: (expected: { ctaLabel: string; lockToken: string; adminToken: string }) => void;
        saveTokensSent: (...lockTokens: string[]) => void;
        savesSent: (count: number) => void;
        savedConfirmationIsShown: () => Promise<void>;
        conflictMessageIsShown: () => Promise<void>;
        failureMessageIsShown: (message: string) => Promise<void>;
        urgentCtaLabelIs: (label: string) => void;
        loadErrorIsShown: () => Promise<void>;
        weightsAre: (calm: string, urgent: string) => void;
    };
};

export const makeAdminDriver = (): AdminDriver => {
    const user = userEvent.setup();

    const saves = (): RecordedRequest[] =>
        fakeHttp.requests().filter((request) => request.method === HttpMethod.Patch && request.path === SAVE_PATH);

    const lastSave = (): RecordedRequest => {
        const last = saves().at(-1);
        if (last === undefined) throw new Error('AdminDriver: no save was sent');

        return last;
    };

    // A type predicate, not a cast: the recorded body arrives as `unknown` and this is the one
    // place that says what a save looks like on the wire.
    const isUpdatePayload = (body: unknown): body is FeatureFlagUpdatePayload =>
        isPlainObject(body) && typeof body['updatedAt'] === 'string' && Array.isArray(body['variants']);

    const savedPayload = (request: RecordedRequest): FeatureFlagUpdatePayload => {
        if (!isUpdatePayload(request.body)) {
            throw new Error(`AdminDriver: the save body is not a flag update — ${JSON.stringify(request.body)}`);
        }

        return request.body;
    };

    const typeInto = async (testId: string, value: string): Promise<void> => {
        const field = screen.getByTestId(testId);
        await user.clear(field);
        await user.type(field, value);
    };

    const messageOf = (): HTMLElement =>
        screen.getByTestId(flagFieldTestId({ flagKey: RESULT_SCREEN_TONE, field: FlagField.SaveMessage }));

    return {
        given: {
            theServerListsFlags: (...flags: FeatureFlagDTO[]): void => {
                fakeHttp.respond({ method: HttpMethod.Get, path: '/feature-flags', status: 200, body: flags });
            },
            theFlagListFails: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Get,
                    path: '/feature-flags',
                    status: HTTP_SERVER_ERROR,
                    body: { error: 'internal error' },
                });
            },
            theSaveSucceedsWithToken: (token: string): void => {
                fakeHttp.respond({
                    method: HttpMethod.Patch,
                    path: SAVE_PATH,
                    status: 200,
                    body: { updatedAt: token },
                });
            },
            theSaveConflicts: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Patch,
                    path: SAVE_PATH,
                    status: HTTP_CONFLICT,
                    body: { error: 'update_feature_flag: optimistic lock conflict' },
                });
            },
            theSaveFails: (): void => {
                fakeHttp.respond({
                    method: HttpMethod.Patch,
                    path: SAVE_PATH,
                    status: HTTP_SERVER_ERROR,
                    body: { error: 'internal error' },
                });
            },
        },
        when: {
            created: async (): Promise<void> => {
                await act(async () => {
                    renderWithProviders(<Admin />, { route: '/admin' });
                });
            },
        },
        type: {
            adminToken: async (token: string): Promise<void> => {
                await typeInto(AdminTestIds.AdminToken, token);
            },
            urgentCtaLabel: async (label: string): Promise<void> => {
                await typeInto(urgentFieldId(CopyField.CtaLabel), label);
            },
            urgentWeight: async (weight: string): Promise<void> => {
                await typeInto(urgentFieldId(WEIGHT_FIELD), weight);
            },
        },
        click: {
            save: async (): Promise<void> => {
                await user.click(
                    screen.getByTestId(flagFieldTestId({ flagKey: RESULT_SCREEN_TONE, field: FlagField.Save })),
                );
            },
        },
        assert: {
            saveCarried: ({
                ctaLabel,
                lockToken,
                adminToken,
            }: {
                ctaLabel: string;
                lockToken: string;
                adminToken: string;
            }): void => {
                const request = lastSave();
                expect(savedPayload(request).updatedAt).toBe(lockToken);
                const urgentLabels = savedPayload(request)
                    .variants.filter((variant) => variant.key === URGENT)
                    .map((variant) => variant.config.ctaLabel);
                expect(urgentLabels).toStrictEqual([ctaLabel]);
                expect(request.headers[ADMIN_TOKEN_HEADER]).toBe(adminToken);
            },
            saveTokensSent: (...lockTokens: string[]): void => {
                expect(saves().map((request) => savedPayload(request).updatedAt)).toStrictEqual(lockTokens);
            },
            savesSent: (count: number): void => {
                expect(saves()).toHaveLength(count);
            },
            savedConfirmationIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(messageOf()).toHaveTextContent('Saved');
                });
            },
            conflictMessageIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(messageOf()).toHaveTextContent('Reload the page');
                });
            },
            failureMessageIsShown: async (message: string): Promise<void> => {
                await waitFor(() => {
                    expect(messageOf()).toHaveTextContent(message);
                });
            },
            urgentCtaLabelIs: (label: string): void => {
                expect(screen.getByTestId(urgentFieldId(CopyField.CtaLabel))).toHaveValue(label);
            },
            loadErrorIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(AdminTestIds.LoadError)).toBeInTheDocument();
                });
            },
            weightsAre: (calm: string, urgent: string): void => {
                expect(
                    screen.getByTestId(
                        variantFieldTestId({ flagKey: RESULT_SCREEN_TONE, variantKey: 'calm', field: WEIGHT_FIELD }),
                    ),
                ).toHaveValue(Number(calm));
                expect(screen.getByTestId(urgentFieldId(WEIGHT_FIELD))).toHaveValue(Number(urgent));
            },
        },
    };
};
