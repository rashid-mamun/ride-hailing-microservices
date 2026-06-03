FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/location-service ./apps/location-service
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @ride-hailing/shared-types build && pnpm --filter @ride-hailing/shared-events build && pnpm --filter @ride-hailing/shared-utils build && pnpm --filter @ride-hailing/location-service build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=builder /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=builder /repo/packages ./packages
COPY --from=builder /repo/apps/location-service/dist ./apps/location-service/dist
COPY --from=builder /repo/apps/location-service/package.json ./apps/location-service/package.json
RUN pnpm install --prod --frozen-lockfile=false
USER node
EXPOSE 3003
CMD ["node", "apps/location-service/dist/src/main.js"]
