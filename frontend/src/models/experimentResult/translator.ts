// Wire → model. The DTO types are the API's shape after the http client has normalised `null`
// to `undefined`, and they live here so nothing else in the app sees a raw results body.

import { FunnelEventName } from '~/models/funnelEvent';
import { Recommendation } from '~/models/experimentResult/model';
import type {
    ArmModel,
    ExperimentResultModel,
    MetricDefinitionModel,
    MetricDefinitionsModel,
    MetricModel,
    StepCountModel,
} from '~/models/experimentResult/model';

export type MetricDefinitionDTO = {
    numerator: string;
    denominator: string;
};

export type StepDTO = {
    name: string;
    visitors: number;
};

export type MetricDTO = {
    successes: number;
    trials: number;
    rate: number | undefined;
};

export type ArmDTO = {
    key: string;
    steps: StepDTO[];
    primary: MetricDTO;
    secondary: MetricDTO;
    guardrail: MetricDTO;
};

export type ZTestDTO = {
    z: number;
    pValue: number;
};

export type EstimateDTO = {
    point: number;
    low: number;
    high: number;
};

export type LiftDTO = {
    absolute: EstimateDTO;
    relative: EstimateDTO;
};

export type ExperimentResultDTO = {
    flagKey: string;
    hypothesis: {
        statement: string;
        baselineRate: number;
        minimumDetectableRelativeLift: number;
    };
    metrics: {
        primary: MetricDefinitionDTO;
        secondary: MetricDefinitionDTO;
        guardrail: MetricDefinitionDTO;
    };
    control: ArmDTO;
    variant: ArmDTO;
    test: ZTestDTO | undefined;
    lift: LiftDTO | undefined;
    sample: {
        requiredPerArm: number;
        reachedPerArm: number;
    };
    recommendation: string;
};

const stepNameFromWire = (wire: string): FunnelEventName => {
    const name = Object.values(FunnelEventName).find((member) => member === wire);
    if (name === undefined) {
        throw new Error(
            `experimentResult.fromDTO: unknown funnel step ${JSON.stringify(wire)} — expected one of ${Object.values(FunnelEventName).join(', ')}`,
        );
    }

    return name;
};

// No fallback: a recommendation the enum does not name is a contract break, and rendering it
// as "keep running" would put a calm banner over a broken dashboard.
const recommendationFromWire = (wire: string): Recommendation => {
    const recommendation = Object.values(Recommendation).find((member) => member === wire);
    if (recommendation === undefined) {
        throw new Error(
            `experimentResult.fromDTO: unknown recommendation ${JSON.stringify(wire)} — expected one of ${Object.values(Recommendation).join(', ')}`,
        );
    }

    return recommendation;
};

const definitionFromDTO = (dto: MetricDefinitionDTO): MetricDefinitionModel => ({
    numerator: stepNameFromWire(dto.numerator),
    denominator: stepNameFromWire(dto.denominator),
});

const definitionsFromDTO = (dto: ExperimentResultDTO['metrics']): MetricDefinitionsModel => ({
    primary: definitionFromDTO(dto.primary),
    secondary: definitionFromDTO(dto.secondary),
    guardrail: definitionFromDTO(dto.guardrail),
});

const stepFromDTO = (dto: StepDTO): StepCountModel => ({ name: stepNameFromWire(dto.name), visitors: dto.visitors });

const metricFromDTO = (dto: MetricDTO): MetricModel => ({
    successes: dto.successes,
    trials: dto.trials,
    rate: dto.rate,
});

const armFromDTO = (dto: ArmDTO): ArmModel => ({
    key: dto.key,
    steps: dto.steps.map(stepFromDTO),
    primary: metricFromDTO(dto.primary),
    secondary: metricFromDTO(dto.secondary),
    guardrail: metricFromDTO(dto.guardrail),
});

export const fromDTO = (dto: ExperimentResultDTO): ExperimentResultModel => ({
    flagKey: dto.flagKey,
    hypothesis: { ...dto.hypothesis },
    metrics: definitionsFromDTO(dto.metrics),
    control: armFromDTO(dto.control),
    variant: armFromDTO(dto.variant),
    test: dto.test === undefined ? undefined : { ...dto.test },
    lift:
        dto.lift === undefined ? undefined : { absolute: { ...dto.lift.absolute }, relative: { ...dto.lift.relative } },
    sample: { ...dto.sample },
    recommendation: recommendationFromWire(dto.recommendation),
});
