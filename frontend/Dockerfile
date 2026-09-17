# Build with the workspace lockfile, serve static files with nginx as a non-root user.
FROM node:24-bookworm-slim AS build

RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /srv

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter @breach-scan/frontend...

COPY frontend ./frontend
RUN pnpm --filter @breach-scan/frontend build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /srv/frontend/dist /usr/share/nginx/html
EXPOSE 8080
