FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/notification-service ./apps/notification-service
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @ride-hailing/shared-types build && pnpm --filter @ride-hailing/shared-events build && pnpm --filter @ride-hailing/shared-utils build && pnpm --filter @ride-hailing/notification-service build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=builder /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/notification-service/dist ./apps/notification-service/dist
COPY --from=builder /repo/apps/notification-service/package.json ./apps/notification-service/package.json
RUN pnpm install --prod --frozen-lockfile=false
USER node
EXPOSE 3005
CMD ["node", "apps/notification-service/dist/src/main.js"]
