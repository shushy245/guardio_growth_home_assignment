"""HTTP shell for the experiment read. The query is the repository's, the arithmetic is
`results.py`'s; this looks the hypothesis up, refuses what it cannot read, and translates.

Open, like the flag list: the dashboard is a page for the team, and nothing here can be
written through it."""

from typing import Annotated

import structlog
from fastapi import APIRouter, HTTPException, Path, status

from app.db.session import SessionDep
from app.experiments import repository
from app.experiments.hypothesis import hypothesis_map
from app.experiments.results import ExperimentRead, assemble_results
from app.experiments.schemas import ExperimentResultsResponse

log = structlog.get_logger()

router = APIRouter()


@router.get("/experiments/{flag_key}/results", response_model=ExperimentResultsResponse)
def get_experiment_results(
    flag_key: Annotated[str, Path(min_length=1, max_length=64)],
    session: SessionDep,
) -> ExperimentResultsResponse:
    ctx = {"flag_key": flag_key}
    log.info("get_experiment_results: started", **ctx)

    hypothesis = hypothesis_map.get(flag_key)
    if hypothesis is None:
        log.info("get_experiment_results: no experiment for this flag", **ctx)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"get_experiment_results: no experiment with flag key {flag_key!r} — the "
                "hypotheses are registered in app/experiments/hypothesis.py"
            ),
        )

    read = assemble_results(
        flag_key=flag_key,
        hypothesis=hypothesis,
        counts=repository.count_visitors_per_step_pair(session=session, flag_key=flag_key),
    )
    log.info("get_experiment_results: completed", **ctx, **_summary_of(read))

    return ExperimentResultsResponse.model_validate(read, from_attributes=True)


def _summary_of(read: ExperimentRead) -> dict[str, str | int]:
    """The figures worth a log line: the two samples, and the call made on them."""
    return {
        "control_trials": read.control.primary.trials,
        "variant_trials": read.variant.primary.trials,
        "required_per_arm": read.sample.required_per_arm,
        "recommendation": read.recommendation,
    }
