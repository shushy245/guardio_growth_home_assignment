// Types only. One step a visitor took, with the id the browser minted for it. The visitor is
// not part of it: the server files the step under the cookie it handed the browser, and a body
// that named a visitor would let a caller file steps under anyone.

export enum FunnelEventName {
    LandingView = 'landing_view',
    ScanStarted = 'scan_started',
    ScanCompleted = 'scan_completed',
    CtaClick = 'cta_click',
    SignupStarted = 'signup_started',
    Activation = 'activation',
}

export type FunnelEventModel = {
    // Minted by the browser, so a retry carries the same one and the server records it once.
    id: string;
    name: FunnelEventName;
    // When the step happened — an instant, not a calendar day.
    occurredAt: Date;
};
