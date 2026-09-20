import { act } from 'react';
import { expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';

import { Admin } from '~/pages/Admin';
import { logger } from '~/logging/logger';
import { CopyField } from '~/models/featureFlag';
import { AdminTestIds } from '~/pages/Admin.utils';
import { isPlainObject } from '~/api/http-client.utils';
import { ADMIN_TOKEN_HEADER } from '~/api/feature-flags';
import { renderWithProviders } from '~/testkit/renderWithProviders';
import { fakeHttp, HttpMethod, type RecordedRequest } from '~/testkit/fake-http';
import type { FeatureFlagDTO, FeatureFlagUpdatePayload } from '~/models/featureFlag';
import { flagFieldTestId, FlagField, variantFieldTestId } from '~/components/FlagEditor.utils';

import styles from '~/pages/Admin.module.scss';

const RESULT_SCREEN_TONE = 'result_screen_tone';
const URGENT = 'urgent';
const SAVE_PATH = `/feature-flags/${RESULT_SCREEN_TONE}`;
const HTTP_SERVER_ERROR = 500;
// What the backend puts in `{ error }`, or what a proxy puts in a status line — written for an
// on-call engineer, never for this page.
const SERVER_ERROR_DETAIL = 'internal error';

export type AdminDriver = {
    given: {
        theServerListsFlags: (...flags: FeatureFlagDTO[]) => void;
        theFlagListFails: () => void;
        theSaveSucceedsWithToken: (token: string) => void;
    };
    when: { created: () => Promise<void> };
    type: {
        adminToken: (token: string) => Promise<void>;
        urgentCtaLabel: (label: string) => Promise<void>;
    };
    click: {
        save: () => Promise<void>;
        retry: () => Promise<void>;
    };
    assert: {
        saveCarried: (expected: { ctaLabel: string; lockToken: string; adminToken: string }) => void;
        savedConfirmationIsShown: () => Promise<void>;
        loadErrorIsShown: () => Promise<void>;
        loadFailureIsShownWithoutTheServersWords: () => Promise<void>;
        loadFailureWasLogged: () => void;
        theFailedLoadDoesNotLookLikeTheLoadingOne: () => void;
        adminTokenFieldIsShown: () => void;
        flagIsShown: () => Promise<void>;
    };
};

export const makeAdminDriver = (): AdminDriver => {
    const user = userEvent.setup();
    const loggedErrors = vi.spyOn(logger, 'error').mockImplementation(() => {});

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

    const saveButton = (): HTMLElement =>
        screen.getByTestId(flagFieldTestId({ flagKey: RESULT_SCREEN_TONE, field: FlagField.Save }));

    const typeInto = async (testId: string, value: string): Promise<void> => {
        const field = screen.getByTestId(testId);
        await user.clear(field);
        await user.type(field, value);
    };

    // The stylesheet's own name for the class, so the driver holds no copy of it. A module that
    // no longer defines it fails here, by name, instead of asserting against `undefined`.
    const classNamed = (className: string | undefined): string => {
        if (className === undefined) throw new Error('AdminDriver: the stylesheet has no such class');

        return className;
    };

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
                    body: { error: SERVER_ERROR_DETAIL },
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
                await typeInto(
                    variantFieldTestId({
                        flagKey: RESULT_SCREEN_TONE,
                        variantKey: URGENT,
                        field: CopyField.CtaLabel,
                    }),
                    label,
                );
            },
        },
        click: {
            save: async (): Promise<void> => {
                await user.click(saveButton());
            },
            retry: async (): Promise<void> => {
                await user.click(screen.getByTestId(AdminTestIds.Retry));
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
            savedConfirmationIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(
                        screen.getByTestId(
                            flagFieldTestId({ flagKey: RESULT_SCREEN_TONE, field: FlagField.SaveMessage }),
                        ),
                    ).toHaveTextContent('Saved');
                });
            },
            loadErrorIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(AdminTestIds.LoadError)).toBeInTheDocument();
                });
            },
            loadFailureIsShownWithoutTheServersWords: async (): Promise<void> => {
                await waitFor(() => {
                    expect(screen.getByTestId(AdminTestIds.LoadError)).toHaveTextContent('could not be loaded');
                });
                expect(screen.getByTestId(AdminTestIds.LoadError)).not.toHaveTextContent(SERVER_ERROR_DETAIL);
            },
            loadFailureWasLogged: (): void => {
                // The prefix is the function that failed, not the page it is read from: that is
                // what makes a grep for the message land on the code that wrote it.
                expect(loggedErrors).toHaveBeenCalledWith(
                    expect.stringContaining('loadFlags'),
                    expect.objectContaining({ detail: SERVER_ERROR_DETAIL }),
                );
            },
            // Byte-identical chips: the failed load rendered the same neutral box as "Loading
            // flags…", so an operator whose load failed saw the box they had been watching and
            // only the words changed (BF51).
            theFailedLoadDoesNotLookLikeTheLoadingOne: (): void => {
                const failed = screen.getByTestId(AdminTestIds.LoadError);
                expect(failed).toHaveClass(classNamed(styles.messageError));
                expect(failed).not.toHaveClass(classNamed(styles.message));
            },
            adminTokenFieldIsShown: (): void => {
                expect(screen.getByTestId(AdminTestIds.AdminToken)).toBeInTheDocument();
            },
            flagIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(saveButton()).toBeInTheDocument();
                });
            },
        },
    };
};
