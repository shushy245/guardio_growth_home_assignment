// How each funnel step is named on screen. One home, so the chart's row labels and the lift
// card's title agree on what `cta_click` is called.

import { FunnelEventName } from '~/models/funnelEvent';

export const stepLabelMap: Record<FunnelEventName, string> = {
    [FunnelEventName.LandingView]: 'Landing',
    [FunnelEventName.ScanStarted]: 'Scan started',
    [FunnelEventName.ScanCompleted]: 'Scan completed',
    [FunnelEventName.CtaClick]: 'CTA click',
    [FunnelEventName.SignupStarted]: 'Sign-up started',
    [FunnelEventName.Activation]: 'Activation',
};

export const labelOfStep = (step: FunnelEventName): string => stepLabelMap[step];
