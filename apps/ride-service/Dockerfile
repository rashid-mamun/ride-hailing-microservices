FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/ride-service ./apps/ride-service
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @ride-hailing/shared-types build && pnpm --filter @ride-hailing/shared-events build && pnpm --filter @ride-hailing/shared-utils build && pnpm --filter @ride-hailing/ride-service build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=builder /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/ride-service/dist ./apps/ride-service/dist
COPY --from=builder /repo/apps/ride-service/package.json ./apps/ride-service/package.json
RUN pnpm install --prod --frozen-lockfile=false
USER node
EXPOSE 3002
CMD ["node", "apps/ride-service/dist/src/main.js"]
