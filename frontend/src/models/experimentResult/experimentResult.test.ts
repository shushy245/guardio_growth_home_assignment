import { describe, expect, it } from 'vitest';

import { FunnelEventName } from '~/models/funnelEvent';
import { anExperimentResultDTO } from '~/testkit/builders';
import { fromDTO, hasEnoughTraffic, hasStatistics, Recommendation } from '~/models/experimentResult';

describe('experimentResult.fromDTO', () => {
    it('reads each step name as the funnel enum member, in funnel order', () => {
        const result = fromDTO(anExperimentResultDTO().build());

        expect(result.control.steps.map((step) => step.name)).toStrictEqual([
            FunnelEventName.LandingView,
            FunnelEventName.ScanStarted,
            FunnelEventName.ScanCompleted,
            FunnelEventName.CtaClick,
            FunnelEventName.SignupStarted,
            FunnelEventName.Activation,
        ]);
    });

    it('reads the recommendation as the enum member it names', () => {
        const result = fromDTO(anExperimentResultDTO().withRecommendation('SHIP_VARIANT').build());

        expect(result.recommendation).toBe(Recommendation.ShipVariant);
    });

    it('refuses a recommendation the enum does not name', () => {
        // A silent fallback to KEEP_RUNNING would render a calm dashboard over a contract break.
        expect(() => fromDTO(anExperimentResultDTO().withRecommendation('SHIP_IT').build())).toThrow('SHIP_IT');
    });

    it('carries an absent rate and absent statistics through as undefined', () => {
        const result = fromDTO(anExperimentResultDTO().beforeAnyVisitor().build());

        expect(result.control.primary.rate).toBeUndefined();
        expect(result.test).toBeUndefined();
        expect(result.lift).toBeUndefined();
    });
});

describe('experimentResult selectors', () => {
    it('has statistics when the API measured a test and a lift', () => {
        expect(hasStatistics(fromDTO(anExperimentResultDTO().build()))).toBe(true);
    });

    it('has no statistics before anyone has been through', () => {
        expect(hasStatistics(fromDTO(anExperimentResultDTO().beforeAnyVisitor().build()))).toBe(false);
    });

    it('has enough traffic once the smaller arm reaches the required sample', () => {
        const result = fromDTO(
            anExperimentResultDTO().withSample({ requiredPerArm: 4921, reachedPerArm: 4921 }).build(),
        );

        expect(hasEnoughTraffic(result)).toBe(true);
    });

    it('lacks traffic while the smaller arm is short of the required sample', () => {
        const result = fromDTO(
            anExperimentResultDTO().withSample({ requiredPerArm: 4921, reachedPerArm: 4920 }).build(),
        );

        expect(hasEnoughTraffic(result)).toBe(false);
    });
});
