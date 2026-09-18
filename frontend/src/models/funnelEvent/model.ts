// Types only. One step a visitor took, with the id the browser minted for it.

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
    visitorId: string;
    name: FunnelEventName;
    // When the step happened — an instant, not a calendar day.
    occurredAt: Date;
};
