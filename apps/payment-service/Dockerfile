FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/payment-service/package.json apps/payment-service/package.json
COPY packages packages
RUN pnpm install --frozen-lockfile
COPY apps/payment-service apps/payment-service
RUN pnpm --filter @ride-hailing/shared-types build && pnpm --filter @ride-hailing/shared-events build && pnpm --filter @ride-hailing/shared-utils build && pnpm --filter @ride-hailing/payment-service build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@8.15.9 --activate
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/payment-service/dist ./apps/payment-service/dist
COPY --from=builder /app/apps/payment-service/package.json ./apps/payment-service/package.json
RUN pnpm install --prod --frozen-lockfile=false
USER node
EXPOSE 3006
CMD ["node", "apps/payment-service/dist/src/main.js"]
