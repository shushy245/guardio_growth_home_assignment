"""The wire contract for the experiment read: what the dashboard receives, camelCase.

Every model reads from the frozen dataclasses in `results.py`, `stats.py` and
`recommendation.py` by attribute, so the domain values are built once and only translated
here. `None` becomes `null`; nothing here can produce a `NaN`.
"""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

from app.experiments.recommendation import Recommendation
from app.funnel_events.models import FunnelEventName

_wire = ConfigDict(
    alias_generator=to_camel, populate_by_name=True, frozen=True, from_attributes=True
)


class MetricDefinitionResponse(BaseModel):
    model_config = _wire

    numerator: FunnelEventName
    denominator: FunnelEventName


class MetricDefinitionsResponse(BaseModel):
    model_config = _wire

    primary: MetricDefinitionResponse
    secondary: MetricDefinitionResponse
    guardrail: MetricDefinitionResponse


class HypothesisResponse(BaseModel):
    model_config = _wire

    statement: str
    baseline_rate: float
    minimum_detectable_relative_lift: float


class StepResponse(BaseModel):
    model_config = _wire

    name: FunnelEventName
    visitors: int


class MetricResponse(BaseModel):
    model_config = _wire

    successes: int
    trials: int
    rate: float | None


class ArmResponse(BaseModel):
    model_config = _wire

    key: str
    steps: list[StepResponse]
    primary: MetricResponse
    secondary: MetricResponse
    guardrail: MetricResponse


class ZTestResponse(BaseModel):
    model_config = _wire

    z: float
    p_value: float


class EstimateResponse(BaseModel):
    model_config = _wire

    point: float
    low: float
    high: float


class LiftResponse(BaseModel):
    model_config = _wire

    absolute: EstimateResponse
    relative: EstimateResponse


class SampleResponse(BaseModel):
    model_config = _wire

    required_per_arm: int
    reached_per_arm: int


class ExperimentResultsResponse(BaseModel):
    model_config = _wire

    flag_key: str
    hypothesis: HypothesisResponse
    metrics: MetricDefinitionsResponse
    control: ArmResponse
    variant: ArmResponse
    test: ZTestResponse | None
    lift: LiftResponse | None
    sample: SampleResponse
    recommendation: Recommendation
