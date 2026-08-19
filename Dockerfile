FROM node:24-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Do not run postinstall yet: Prisma generation needs the complete schema and
# a harmless build-time DATABASE_URL.
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS builder

COPY . .
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm prisma generate
# Next evaluates server route modules while collecting build output. These are
# intentionally non-secret placeholders for that build step; deployment values
# are supplied to the runner container at runtime.
ENV NODE_ENV=production \
    DATABASE_URL=postgresql://build:build@localhost:5432/build \
    AUTH_SECRET=build-only-auth-secret-0123456789012345 \
    APP_URL=http://build.local \
    STORAGE_ENDPOINT=http://storage.build.local \
    STORAGE_REGION=us-east-1 \
    STORAGE_BUCKET=build-only \
    STORAGE_ACCESS_KEY_ID=build-only-access-key \
    STORAGE_SECRET_ACCESS_KEY=build-only-secret-key \
    STORAGE_FORCE_PATH_STYLE=true \
    SELECTION_WORKER_SECRET=build-only-selection-secret-012345678901 \
    AGREEMENT_WORKER_SECRET=build-only-agreement-secret-012345678901
RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production

# The Prisma CLI and tsx are intentionally retained so migrations and the
# one-off demo seed can be run inside the deployed container.
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod 755 docker-entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
