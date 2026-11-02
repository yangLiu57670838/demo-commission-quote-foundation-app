# Node images for the BFF and the mock vendor.
# The vendor api-key is not a build arg and is not copied in. Compose injects it at runtime.
# Do not add VENDOR_API_KEY or VENDOR_API_URL to an ENV or ARG line.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bff/package.json apps/bff/package.json
COPY apps/mock-vendor/package.json apps/mock-vendor/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json

FROM base AS bff
RUN pnpm install --frozen-lockfile --filter @commission-quote/bff...
COPY tsconfig.base.json ./
COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY apps/bff/src apps/bff/src
COPY apps/bff/tsconfig.json apps/bff/tsconfig.json
ENV NODE_ENV=production HOME=/tmp XDG_CACHE_HOME=/tmp
USER node
WORKDIR /app/apps/bff
EXPOSE 4000
CMD ["node", "--import", "tsx", "src/index.ts"]

FROM base AS mock-vendor
RUN pnpm install --frozen-lockfile --filter @commission-quote/mock-vendor...
COPY tsconfig.base.json ./
COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY apps/mock-vendor/src apps/mock-vendor/src
COPY apps/mock-vendor/tsconfig.json apps/mock-vendor/tsconfig.json
ENV NODE_ENV=production HOME=/tmp XDG_CACHE_HOME=/tmp
USER node
WORKDIR /app/apps/mock-vendor
EXPOSE 4001
CMD ["node", "--import", "tsx", "src/index.ts"]
