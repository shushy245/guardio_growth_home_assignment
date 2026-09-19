#!/usr/bin/env sh
# One command for the whole stack in development: the compose database, the migrations the
# compose backend would have applied, then uvicorn and vite in parallel with hot reload.
# Ctrl-C stops both servers; the database keeps running (`docker compose stop db` stops it).
set -e

cd "$(dirname "$0")/.."

docker compose up -d --wait db
(cd backend && uv run --env-file ../.env alembic upgrade head)

# kill 0 signals the whole process group, so one Ctrl-C takes uvicorn and vite down together —
# without it the background jobs outlive the script and hold ports 8000 and 5173.
trap 'kill 0' INT TERM

(cd backend && uv run --env-file ../.env uvicorn app.asgi:app --port 8000 --reload) &
(cd frontend && pnpm dev) &
wait
