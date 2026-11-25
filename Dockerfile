# agentes.chat image: API, WebSocket, workers and the web app in one Bun process.
# Self-hosting runs it with docker-compose.yml; agentes.chat Cloud runs the same image.
FROM oven/bun:1.4.4 AS build
WORKDIR /app
COPY . .
# Wyrd-OS: apply the branding (brand/README.md) before building.
RUN bun brand/apply.ts
RUN bun install --frozen-lockfile \
 && bun run --filter '@agenteschat/web' build \
 && bun build apps/server/runner/main.ts --target=node --banner '#!/usr/bin/env node' --outfile apps/web/dist/runner/agentes-runner.mjs
# Wyrd-OS (MODIFICATIONS.md): the server needs only its own production dependencies once the web app and the
# runner are built; the build tools and the phone and desktop apps' packages stay in this stage (2.2 GB → about
# 0.7 GB of node_modules), and so does Bun's download cache.
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules \
 && bun install --frozen-lockfile --production --filter '@agenteschat/server'

FROM oven/bun:1.4.4
WORKDIR /app
# A named volume mounted on an empty image directory takes its owner: FILES_DIR in docker-compose.yml.
RUN install -d -o bun -g bun /data/files
COPY --from=build /app /app
# The root filesystem can be read-only: the server writes only to /tmp and FILES_DIR, and the
# base image already turns off Bun's transpiler cache (BUN_RUNTIME_TRANSPILER_CACHE_PATH=0).
ENV NODE_ENV=production \
    WEB_DIR=/app/apps/web/dist \
    PORT=3000
USER bun
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s \
  CMD ["bun", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# ENTRYPOINT, not CMD, so `docker compose run --rm agentes migrate` reaches main.ts as argv. An
# absolute path: `docker run -w /work … setup` runs it from the directory being set up.
ENTRYPOINT ["bun", "/app/apps/server/src/main.ts"]
