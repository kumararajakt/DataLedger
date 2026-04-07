# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json .
COPY src ./src
RUN pnpm build

# Copy SQL migrations alongside compiled output (tsc doesn't copy non-TS files)
RUN mkdir -p dist/db/migrations && cp src/db/migrations/*.sql dist/db/migrations/

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh && chown -R node:node /app

# Run as non-root — required for rootless Podman, best practice for Docker
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["./entrypoint.sh"]
