FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY server.ts ./
COPY api ./api

ENV NODE_ENV=production
ENV PORT=8080
# DATABASE_URL and IXMP4_* credentials are supplied at runtime (--env-file / compose).
# The API's tables live in the `catalog` schema of the shared Postgres.
ENV DB_SCHEMA=catalog

EXPOSE 8080

CMD ["bun", "run", "server.ts"]
