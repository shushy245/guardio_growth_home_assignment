import { expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { act, type ReactElement, useState } from 'react';

import { FlagEditor } from '~/components/FlagEditor';
import { aFeatureFlagDTO } from '~/testkit/builders';
import { isPlainObject } from '~/api/http-client.utils';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';
import { flagFieldTestId, FlagField, variantFieldTestId, WEIGHT_FIELD } from '~/components/FlagEditor.utils';
import {
    CopyField,
    type FeatureFlagDTO,
    type FeatureFlagModel,
    type FeatureFlagUpdatePayload,
    fromDTO,
} from '~/models/featureFlag';

const RESULT_SCREEN_TONE = 'result_screen_tone';
const URGENT = 'urgent';
const SAVE_PATH = `/feature-flags/${RESULT_SCREEN_TONE}`;
const HTTP_CONFLICT = 409;
const HTTP_SERVER_ERROR = 500;

const urgentFieldId = (field: CopyField | typeof WEIGHT_FIELD): string =>
    variantFieldTestId({ flagKey: RESULT_SCREEN_TONE, variantKey: URGENT, field });

// The parent the editor is rendered under. It holds the flag exactly as the Admin page does, so
// an edit applied through `onChange` and a lock token advanced after a save are exercised through
// the real contract rather than a frozen prop the editor could never have changed.
const FlagEditorHost = ({ flag, adminToken }: { flag: FeatureFlagModel; adminToken: string }): ReactElement => {
    const [current, setCurrent] = useState(flag);

    return <FlagEditor flag={current} adminToken={adminToken} onChange={setCurrent} />;
};

export type FlagEditorDriver = {
    given: {
        theFlag: (dto: FeatureFlagDTO) => void;
        theAdminToken: (token: string) => void;
        theSaveSucceedsWithToken: (token: string) => void;
        theSaveConflicts: () => void;
        theSaveFails: () => void;
    };
    when: { created: () => Promise<void> };
    type: {
        urgentCtaLabel: (label: string) => Promise<void>;
        urgentWeight: (weight: string) => Promise<void>;
    };
    click: {
        save: () => Promise<void>;
        enabled: () => Promise<void>;
    };
    assert: {
        saveCarried: (expected: { isEnabled: boolean }) => void;
        saveTokensSent: (...lockTokens: string[]) => void;
        savesSent: (count: number) => void;
        savedConfirmationIsShown: () => Promise<void>;
        conflictMessageIsShown: () => Promise<void>;
        failureMessageIsShown: (message: string) => Promise<void>;
        urgentCtaLabelIs: (label: string) => void;
    };
};

export const makeFlagEditorDriver = (): FlagEditorDriver => {
    const user = userEvent.setup();

    let dto = aFeatureFlagDTO().build();
    let adminToken = 'the-pasted-admin-token';

    const saves = (): RecordedRequest[] =>
        fakeHttp.requests().filter((request) => request.method === HttpMethod.Patch && request.path === SAVE_PATH);

    // A type predicate, not a cast: the recorded body arrives as `unknown` and this is the one
    // place that says what a save looks like on the wire.
    const isUpdatePayload = (body: unknown): body is FeatureFlagUpdatePayload =>
        isPlainObject(body) &&
        typeof body['updatedAt'] === 'string' &&
        typeof body['isEnabled'] === 'boolean' &&
        Array.isArray(body['variants']);

    const lastSave = (): RecordedRequest => {
        const last = saves().at(-1);
        if (last === undefined) throw new Error('FlagEditorDriver: no save was sent');

        return last;
    };

    const savedPayload = (request: RecordedRequest): FeatureFlagUpdatePayload => {
        if (!isUpdatePayload(request.body)) {
            throw new Error(`FlagEditorDriver: the save body is not a flag update — ${JSON.stringify(request.body)}`);
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
            theFlag: (flag: FeatureFlagDTO): void => {
                dto = flag;
            },
            theAdminToken: (token: string): void => {
                adminToken = token;
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
                    renderWithProviders(<FlagEditorHost flag={fromDTO(dto)} adminToken={adminToken} />, {
                        route: '/admin',
                    });
                });
            },
        },
        type: {
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
            enabled: async (): Promise<void> => {
                await user.click(
                    screen.getByTestId(flagFieldTestId({ flagKey: RESULT_SCREEN_TONE, field: FlagField.Enabled })),
                );
            },
        },
        assert: {
            saveCarried: ({ isEnabled }: { isEnabled: boolean }): void => {
                expect(savedPayload(lastSave()).isEnabled).toBe(isEnabled);
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
        },
    };
};
