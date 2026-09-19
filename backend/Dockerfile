# Pinned base, non-root runtime user, dependencies from the lockfile only.
FROM python:3.12-slim-bookworm AS base

COPY --from=ghcr.io/astral-sh/uv:0.9 /uv /usr/local/bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /srv/backend

# Install dependencies first so source edits do not invalidate the layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY migrations ./migrations
COPY scripts ./scripts
COPY alembic.ini ./
RUN uv sync --frozen --no-dev

RUN useradd --create-home --uid 10001 app && chown -R app:app /srv/backend
USER app

EXPOSE 8000
# Migrations run on start so a fresh clone is usable with one command; forward-only by policy.
#
# --proxy-headers with --forwarded-allow-ips='*' makes uvicorn trust X-Forwarded-For/-Proto from
# any peer. That is right for this compose stack, where the only route in is the nginx container
# and a forged header would at worst mislabel a line in the log. A deployment narrows it to the
# proxy's address, because port 8000 published to the host is reachable without going through
# nginx at all.
CMD ["sh", "-c", "uv run --no-sync alembic upgrade head && uv run --no-sync uvicorn app.asgi:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
