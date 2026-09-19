// Builder for the experiment-results wire shape: what `GET /api/experiments/{flagKey}/results`
// answers, after the http client has turned every `null` into `undefined`.
//
// The default is a read mid-run: both arms at 1,000 scan completions, 8% against 10%, a z-test
// and a lift present, and a call of KEEP_RUNNING because 1,000 is short of the 4,921 the
// hypothesis asks for. `with*` reassigns `this.state` and never mutates it in place.

import type { ArmDTO, ExperimentResultDTO, LiftDTO, StepDTO, ZTestDTO } from '~/models/experimentResult';

const STEP_NAMES = ['landing_view', 'scan_started', 'scan_completed', 'cta_click', 'signup_started', 'activation'];

const stepsOf = (visitors: number[]): StepDTO[] =>
    STEP_NAMES.map((name, index) => ({ name, visitors: visitors[index] ?? 0 }));

const CALM: ArmDTO = {
    key: 'calm',
    steps: stepsOf([1250, 1060, 1000, 350, 210, 80]),
    primary: { successes: 80, trials: 1000, rate: 0.08 },
    secondary: { successes: 350, trials: 1000, rate: 0.35 },
    guardrail: { successes: 80, trials: 350, rate: 80 / 350 },
};

const URGENT: ArmDTO = {
    key: 'urgent',
    steps: stepsOf([1240, 1055, 1000, 350, 210, 100]),
    primary: { successes: 100, trials: 1000, rate: 0.1 },
    secondary: { successes: 350, trials: 1000, rate: 0.35 },
    guardrail: { successes: 100, trials: 350, rate: 100 / 350 },
};

const EMPTY_ARM = (key: string): ArmDTO => ({
    key,
    steps: stepsOf([]),
    primary: { successes: 0, trials: 0, rate: undefined },
    secondary: { successes: 0, trials: 0, rate: undefined },
    guardrail: { successes: 0, trials: 0, rate: undefined },
});

const MID_RUN_TEST: ZTestDTO = { z: 1.5627, pValue: 0.11813 };

const MID_RUN_LIFT: LiftDTO = {
    absolute: { point: 0.02, low: -0.00507, high: 0.04507 },
    relative: { point: 0.25, low: -0.0559, high: 0.6549 },
};

const MID_RUN: ExperimentResultDTO = {
    flagKey: 'result_screen_tone',
    hypothesis: {
        statement:
            'An urgent framing of the result screen raises the activation rate (visitors who complete a scan and go on to activate) by at least 20% relative.',
        baselineRate: 0.08,
        minimumDetectableRelativeLift: 0.2,
    },
    metrics: {
        primary: { numerator: 'activation', denominator: 'scan_completed' },
        secondary: { numerator: 'cta_click', denominator: 'scan_completed' },
        guardrail: { numerator: 'activation', denominator: 'cta_click' },
    },
    control: CALM,
    variant: URGENT,
    test: MID_RUN_TEST,
    lift: MID_RUN_LIFT,
    sample: { requiredPerArm: 4921, reachedPerArm: 1000 },
    recommendation: 'KEEP_RUNNING',
};

class ExperimentResultDTOBuilder {
    private state: ExperimentResultDTO = { ...MID_RUN };

    withRecommendation(recommendation: string): this {
        this.state = { ...this.state, recommendation };

        return this;
    }

    withSample({ requiredPerArm, reachedPerArm }: { requiredPerArm: number; reachedPerArm: number }): this {
        this.state = { ...this.state, sample: { requiredPerArm, reachedPerArm } };

        return this;
    }

    withPValue(pValue: number): this {
        this.state = { ...this.state, test: { ...MID_RUN_TEST, pValue } };

        return this;
    }

    // The read before anyone has been through: every step at zero, every rate and both
    // statistics absent — exactly what the API sends for a fresh database.
    beforeAnyVisitor(): this {
        this.state = {
            ...this.state,
            control: EMPTY_ARM('calm'),
            variant: EMPTY_ARM('urgent'),
            test: undefined,
            lift: undefined,
            sample: { ...this.state.sample, reachedPerArm: 0 },
            recommendation: 'KEEP_RUNNING',
        };

        return this;
    }

    build(): ExperimentResultDTO {
        return this.state;
    }
}

export const anExperimentResultDTO = (): ExperimentResultDTOBuilder => new ExperimentResultDTOBuilder();
