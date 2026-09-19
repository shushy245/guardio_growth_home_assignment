// Types only. What the sign-up form collects, and the plan it chose.

// The wire values; the backend's `Plan` enum carries the same two.
export enum Plan {
    Basic = 'basic',
    Family = 'family',
}

export type SignupModel = {
    email: string;
    plan: Plan;
    password: string;
    // What the k-anonymity check found for this exact password at submit time.
    passwordWasPwned: boolean;
};

export type SignupCreatedModel = {
    id: string;
    createdAt: Date;
};
