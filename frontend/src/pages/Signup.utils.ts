// The sign-up page's testable surface: its ids and copy, where it leads, the inline validation
// the design shows on submit, and the shape of the submission. The component file exports only
// the component.

import { Plan } from '~/models/signup';
import { statusOfError } from '~/api/http-client';
import { isTooShort, PASSWORD_TOO_SHORT_MESSAGE } from '~/components/PasswordField.utils';

// A test id is its own access path (docs/testing-conventions.md §test ids): the string in the DOM
// is exactly what you grep for to find the code that renders it.
export enum SignupTestIds {
    Page = 'SignupTestIds.Page',
    Email = 'SignupTestIds.Email',
    EmailError = 'SignupTestIds.EmailError',
    Submit = 'SignupTestIds.Submit',
    ServerMessage = 'SignupTestIds.ServerMessage',
}

// Where a successful sign-up leads. The route table in App is the other reader of this path,
// and the confirmation page reads the plan from the navigation state.
export const PROTECTED_ROUTE = '/protected';

export type ProtectedRouteState = { plan: Plan };

export const SIGNUP_HEADLINE = 'Choose your plan';
export const SIGNUP_NOTE = 'This is a demo — nothing is charged.';
export const EMAIL_LABEL = 'Email';
export const EMAIL_INVALID_MESSAGE = 'Enter a valid email address';
export const SUBMIT_LABEL = 'Start protection';
export const SUBMITTING_LABEL = 'Starting protection…';
export const EMAIL_TAKEN_MESSAGE = 'That email already has an account.';
export const SIGNUP_FAILED_MESSAGE = "We couldn't start your protection. Try again.";

// The design selects Family; the visitor can change it.
export const DEFAULT_PLAN = Plan.Family;

const HTTP_CONFLICT = 409;

// Display rules only: something with an @ and a dot after it. The backend is the boundary.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (email: string): boolean => EMAIL_SHAPE.test(email.trim());

export type SignupValidation = {
    email: string | undefined;
    password: string | undefined;
};

export const NO_VALIDATION_ERRORS: SignupValidation = { email: undefined, password: undefined };

export const validateSignupForm = ({ email, password }: { email: string; password: string }): SignupValidation => ({
    email: isValidEmail(email) ? undefined : EMAIL_INVALID_MESSAGE,
    password: isTooShort(password) ? PASSWORD_TOO_SHORT_MESSAGE : undefined,
});

export const hasValidationErrors = (validation: SignupValidation): boolean =>
    validation.email !== undefined || validation.password !== undefined;

// What the visitor reads when the server refuses: a taken email in its own words, everything
// else as one failure they can retry — the detail goes to the log, never to the screen.
export const describeSignupFailure = (error: unknown): string =>
    statusOfError(error) === HTTP_CONFLICT ? EMAIL_TAKEN_MESSAGE : SIGNUP_FAILED_MESSAGE;

export enum SubmissionStatus {
    Idle = 'idle',
    Submitting = 'submitting',
    Failed = 'failed',
}

export type Submission =
    | { status: SubmissionStatus.Idle }
    | { status: SubmissionStatus.Submitting }
    | { status: SubmissionStatus.Failed; message: string };

export const IDLE_SUBMISSION: Submission = { status: SubmissionStatus.Idle };

export const isSubmitting = (submission: Submission): boolean => submission.status === SubmissionStatus.Submitting;

export const isFailed = (
    submission: Submission,
): submission is Extract<Submission, { status: SubmissionStatus.Failed }> =>
    submission.status === SubmissionStatus.Failed;
