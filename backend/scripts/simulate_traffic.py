"""Drive simulated visitors through a running API and print the experiment's read.

    uv run python scripts/simulate_traffic.py --visitors 4000 --activation calm=0.08 urgent=0.10 \
        > docs/simulation-read.json

Argument parsing and the real HTTP client live here; the walk itself is
`app.experiments.simulation`, which the integration tests drive against an in-process app. The
read printed at the end is the dashboard's own endpoint, so the number in the README is the
number on the screen.

There is no `--seed`: the arm is decided by the id the server mints, so no seed could make a
run repeatable, and `SystemRandom` is the source a security lint does not have to be argued with.
"""

import argparse
import random
import sys

import httpx2 as httpx
import structlog

from app.experiments.hypothesis import RESULT_SCREEN_TONE
from app.experiments.simulation import MAX_ACTIVATION_RATE, simulate_traffic

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_VISITORS = 4000
REQUEST_TIMEOUT_SECONDS = 10.0


def parse_arm_rate(text: str) -> tuple[str, float]:
    """`calm=0.08` → `("calm", 0.08)`; anything else is an argparse error naming the form."""
    arm, separator, rate_text = text.partition("=")
    if not separator or not arm:
        msg = f"expected <arm>=<rate>, e.g. calm=0.08, got {text!r}"
        raise argparse.ArgumentTypeError(msg)
    try:
        rate = float(rate_text)
    except ValueError as exc:
        msg = f"the rate in {text!r} is not a number"
        raise argparse.ArgumentTypeError(msg) from exc
    if not 0 < rate <= MAX_ACTIVATION_RATE:
        msg = f"the rate in {text!r} must be in (0, {MAX_ACTIVATION_RATE:.2f}]"
        raise argparse.ArgumentTypeError(msg)

    return arm, rate


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--visitors", type=int, default=DEFAULT_VISITORS)
    parser.add_argument(
        "--activation",
        type=parse_arm_rate,
        nargs="+",
        required=True,
        metavar="ARM=RATE",
        help="activation rate (of scan_completed) per arm, e.g. calm=0.08 urgent=0.10",
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)

    return parser


def main(argv: list[str]) -> None:
    # Data on stdout, diagnostics on stderr, as a CLI is expected to: structlog's default printer
    # writes to stdout, and the first run put its progress lines in front of the JSON.
    structlog.configure(logger_factory=structlog.PrintLoggerFactory(file=sys.stderr))
    args = build_parser().parse_args(argv)
    activation_rates = dict(args.activation)

    def open_browser() -> httpx.Client:
        return httpx.Client(base_url=args.base_url, timeout=REQUEST_TIMEOUT_SECONDS)

    simulate_traffic(
        visitors=args.visitors,
        activation_rates=activation_rates,
        rng=random.SystemRandom(),
        open_browser=open_browser,
    )

    with open_browser() as browser:
        results = browser.get(f"/api/experiments/{RESULT_SCREEN_TONE}/results")
    results.raise_for_status()
    sys.stdout.write(results.text + "\n")


if __name__ == "__main__":
    main(sys.argv[1:])
