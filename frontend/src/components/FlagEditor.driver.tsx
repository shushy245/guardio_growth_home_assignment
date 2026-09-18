import { expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import { act, type ReactElement, useState } from 'react';

import { logger } from '~/logging/logger';
import { FlagEditor } from '~/components/FlagEditor';
import { aFeatureFlagDTO } from '~/testkit/builders';
import { aMediaQueryList } from '~/testkit/media-query';
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
    setLockToken,
} from '~/models/featureFlag';

const RESULT_SCREEN_TONE = 'result_screen_tone';
const URGENT = 'urgent';
const SAVE_PATH = `/feature-flags/${RESULT_SCREEN_TONE}`;
const HTTP_CONFLICT = 409;
const HTTP_SERVER_ERROR = 500;
// What the backend puts in `{ error }` — written for an on-call engineer, never for this page.
const SERVER_ERROR_DETAIL = 'internal error';
const ENABLED_LABEL = 'Running — assign new visitors to a variant';

const urgentFieldId = (field: CopyField | typeof WEIGHT_FIELD): string =>
    variantFieldTestId({ flagKey: RESULT_SCREEN_TONE, variantKey: URGENT, field });

// The parent the editor is rendered under. It holds the flag exactly as the Admin page does, so
// an edit applied through `onChange` and a lock token advanced after a save are exercised through
// the real contract rather than a frozen prop the editor could never have changed.
const FlagEditorHost = ({ flag, adminToken }: { flag: FeatureFlagModel; adminToken: string }): ReactElement => {
    const [current, setCurrent] = useState(flag);

    const handleSaved = ({ lockToken }: { flagKey: string; lockToken: string }): void => {
        setCurrent((latest) => setLockToken(latest, lockToken));
    };

    return <FlagEditor flag={current} adminToken={adminToken} onChange={setCurrent} onSaved={handleSaved} />;
};

export type FlagEditorDriver = {
    given: {
        theFlag: (dto: FeatureFlagDTO) => void;
        theAdminToken: (token: string) => void;
        theSaveSucceedsWithToken: (token: string) => void;
        theSaveHangs: (token: string) => void;
        theOperatorPrefersReducedMotion: () => void;
        theSaveConflicts: () => void;
        theSaveFails: () => void;
    };
    when: {
        created: () => Promise<void>;
        theSaveResponds: () => Promise<void>;
    };
    type: {
        urgentCtaLabel: (label: string) => Promise<void>;
        urgentWeight: (weight: string) => Promise<void>;
    };
    click: {
        save: () => Promise<void>;
        enabled: () => Promise<void>;
        enabledLabelText: () => Promise<void>;
    };
    assert: {
        saveCarried: (expected: { isEnabled: boolean }) => void;
        saveTokensSent: (...lockTokens: string[]) => void;
        savesSent: (count: number) => void;
        savedConfirmationIsShown: () => Promise<void>;
        noSaveMessageIsShown: () => void;
        saveIsOffered: () => void;
        saveMessagesAreAnnounced: () => void;
        saveResultWasBroughtIntoView: () => Promise<void>;
        saveResultWasBroughtIntoViewWithoutMotion: () => Promise<void>;
        variantFieldsAreNamedPerVariant: () => void;
        nothingWasBroughtIntoView: () => void;
        saveIsNotOffered: () => void;
        urgentWeightIs: (weight: number) => void;
        conflictMessageIsShown: () => Promise<void>;
        failureMessageIsShown: (message: string) => Promise<void>;
        saveFailureIsShown: () => Promise<void>;
        saveFailureWasLogged: () => void;
        urgentCtaLabelIs: (label: string) => void;
    };
};

export const makeFlagEditorDriver = (): FlagEditorDriver => {
    const user = userEvent.setup();

    let dto = aFeatureFlagDTO().build();
    let adminToken = 'the-pasted-admin-token';
    let releaseSave: (() => void) | undefined = undefined;
    const loggedErrors = vi.spyOn(logger, 'error').mockImplementation(() => {});
    // jsdom has no layout and therefore no scrollIntoView; the driver supplies it so the call
    // the component makes in a real browser is observable here.
    const scrolled = vi.fn();
    let reducedMotion = false;

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

    const saveButton = (): HTMLElement =>
        screen.getByTestId(flagFieldTestId({ flagKey: RESULT_SCREEN_TONE, field: FlagField.Save }));

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
            theSaveHangs: (token: string): void => {
                fakeHttp.respond({
                    method: HttpMethod.Patch,
                    path: SAVE_PATH,
                    status: 200,
                    body: { updatedAt: token },
                    gate: new Promise<void>((resolve) => {
                        releaseSave = resolve;
                    }),
                });
            },
            theOperatorPrefersReducedMotion: (): void => {
                reducedMotion = true;
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
                    body: { error: SERVER_ERROR_DETAIL },
                });
            },
        },
        when: {
            created: async (): Promise<void> => {
                Element.prototype.scrollIntoView = scrolled;
                window.matchMedia = (media: string): MediaQueryList =>
                    aMediaQueryList({
                        media,
                        matches: reducedMotion && media.includes('prefers-reduced-motion'),
                    });
                await act(async () => {
                    renderWithProviders(<FlagEditorHost flag={fromDTO(dto)} adminToken={adminToken} />, {
                        route: '/admin',
                    });
                });
            },
            theSaveResponds: async (): Promise<void> => {
                const release = releaseSave;
                if (release === undefined) throw new Error('FlagEditorDriver: no save is waiting to be released');
                await act(async () => {
                    release();
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
                await user.click(saveButton());
            },
            enabled: async (): Promise<void> => {
                await user.click(
                    screen.getByTestId(flagFieldTestId({ flagKey: RESULT_SCREEN_TONE, field: FlagField.Enabled })),
                );
            },
            // What someone actually hits: the words beside the box, not the 20px box.
            enabledLabelText: async (): Promise<void> => {
                await user.click(screen.getByText(ENABLED_LABEL));
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
            saveResultWasBroughtIntoView: async (): Promise<void> => {
                await waitFor(() => {
                    expect(scrolled).toHaveBeenCalled();
                });
                expect(scrolled.mock.instances.at(-1)).toBe(messageOf());
            },
            saveResultWasBroughtIntoViewWithoutMotion: async (): Promise<void> => {
                await waitFor(() => {
                    expect(scrolled).toHaveBeenCalled();
                });
                expect(scrolled).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }));
            },
            variantFieldsAreNamedPerVariant: (): void => {
                expect(screen.getByTestId(urgentFieldId(CopyField.CtaLabel))).toHaveAccessibleName(
                    'urgent Button label',
                );
                expect(screen.getByTestId(urgentFieldId(WEIGHT_FIELD))).toHaveAccessibleName(
                    'urgent Share of traffic (%)',
                );
            },
            nothingWasBroughtIntoView: (): void => {
                expect(scrolled).not.toHaveBeenCalled();
            },
            saveMessagesAreAnnounced: (): void => {
                expect(messageOf()).toHaveAttribute('role', 'status');
            },
            saveIsOffered: (): void => {
                expect(saveButton()).toBeEnabled();
            },
            saveIsNotOffered: (): void => {
                expect(saveButton()).toBeDisabled();
            },
            urgentWeightIs: (weight: number): void => {
                expect(screen.getByTestId(urgentFieldId(WEIGHT_FIELD))).toHaveValue(weight);
            },
            noSaveMessageIsShown: (): void => {
                expect(messageOf()).toBeEmptyDOMElement();
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
            // The two halves of the same rule: the operator reads operator copy, and the detail
            // that used to be on screen is in the log instead of nowhere.
            saveFailureIsShown: async (): Promise<void> => {
                await waitFor(() => {
                    expect(messageOf()).toHaveTextContent('could not be saved');
                });
                expect(messageOf()).not.toHaveTextContent(SERVER_ERROR_DETAIL);
            },
            saveFailureWasLogged: (): void => {
                expect(loggedErrors).toHaveBeenCalledWith(
                    expect.stringContaining('handleSave'),
                    expect.objectContaining({ detail: SERVER_ERROR_DETAIL }),
                );
            },
            urgentCtaLabelIs: (label: string): void => {
                expect(screen.getByTestId(urgentFieldId(CopyField.CtaLabel))).toHaveValue(label);
            },
        },
    };
};
