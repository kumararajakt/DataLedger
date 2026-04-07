# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Empty VITE_API_URL so axios uses same-origin requests; nginx proxies /api → server
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm build

# ---- Runner ----
# nginx-unprivileged: runs as non-root (uid 101) on port 8080 — works with
# rootless Podman and Docker without any sysctl tuning
FROM nginxinc/nginx-unprivileged:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
