# Build the staff page, then serve it from nginx.
# Do not pass VENDOR_API_KEY, VENDOR_API_URL, or any VITE_ secret as a build arg.
# .dockerignore keeps .env files out of this build.

FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/bff/package.json apps/bff/package.json
COPY apps/mock-vendor/package.json apps/mock-vendor/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --filter @commission-quote/web...
COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/tsconfig.json
COPY apps/web/src apps/web/src
COPY apps/web/index.html apps/web/index.html
COPY apps/web/vite.config.ts apps/web/vite.config.ts
COPY apps/web/tsconfig.app.json apps/web/tsconfig.app.json
COPY apps/web/tsconfig.node.json apps/web/tsconfig.node.json
RUN pnpm --filter @commission-quote/web build \
  && ! grep -R -I -E "VENDOR_API_KEY|VENDOR_API_URL|api-key" apps/web/dist

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=nginx:nginx /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
# Skip the image entrypoint so nginx does not rewrite config as it starts.
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
