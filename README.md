# ride-hailing-microservices

![CI](https://img.shields.io/badge/CI-ready-brightgreen) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![NestJS](https://img.shields.io/badge/NestJS-11-red) ![Node](https://img.shields.io/badge/Node-20-green) ![License](https://img.shields.io/badge/License-MIT-black)

Pathao/Uber-style ride-sharing backend demonstrating microservices, event-driven workflows, Outbox, Saga choreography, payments, Redis GEO tracking, circuit breakers, structured logging and OpenTelemetry tracing.

## Architecture

```text
                    +-------------------------------------+
  Client ---------->|          API Gateway :3000           |
                    |  Rate Limit * JWT Verify * Circuit   |
                    +--+------+------+------+-------------+
                       |      |      |      |
              +--------v-+ +--v---+ +v-----+--+ +---------+
              |   Auth   | | Ride | |Location | | Pricing |
              | :3001    | |:3002 | |  :3003  | |  :3004  |
              +----+-----+ +--+---+ +----+----+ +----+----+
                   |          |           |            |
              +----v----------v-----------v------------v----+
              |              RabbitMQ Exchange               |
              +--------------------+-------------------------+
                         |                 |
                +--------v--------+ +------v-------+
                |  Notification   | |   Payment    |
                |    :3005        | |    :3006     |
                +-----------------+ +--------------+
```

## Features

- [x] NestJS monorepo with pnpm workspaces and Turborepo
- [x] API Gateway with JWT validation, Redis-backed throttling, proxy routing and per-service circuit breakers
- [x] Auth service with TypeORM users, drivers, refresh tokens, bcrypt hashing and JWT refresh flow
- [x] Ride service with PostgreSQL state transitions, idempotency keys and transactional Outbox publishing
- [x] Payment service with Saga payment processing and payment success/failure events
- [x] Saga choreography through RabbitMQ consumers for payment and ride lifecycle events
- [x] Driver matching through location-service nearby driver lookup with circuit-breaker fallback
- [x] Location service with Redis GEO, TTL-based driver presence and Socket.IO ride rooms
- [x] Pricing service with Haversine fare estimation, Redis caching and surge counters
- [x] Notification consumer with email templates, SMTP fallback logging and DLQ-aware RabbitMQ setup
- [x] API v1 route aliases, reusable RBAC guards and refresh-token rotation
- [x] Explicit TypeORM migrations and seed scripts for production-safe schema management
- [x] Shared RabbitMQ event contract validation and delayed retry queues before DLQ
- [x] OpenTelemetry, structured Winston logging, global validation and exception filters
- [x] Docker Compose for local infrastructure and all backend services

## Tech Stack

| Service              | Database             | Key libraries                                     |
| -------------------- | -------------------- | ------------------------------------------------- |
| api-gateway          | Redis                | NestJS, Throttler, http-proxy-middleware, opossum |
| auth-service         | PostgreSQL           | TypeORM, bcrypt, JWT                              |
| ride-service         | PostgreSQL, Redis    | TypeORM, RabbitMQ, Outbox, Schedule               |
| location-service     | Redis                | GEO commands, Socket.IO                           |
| pricing-service      | PostgreSQL, Redis    | TypeORM, Haversine, RabbitMQ                      |
| payment-service      | PostgreSQL, RabbitMQ | TypeORM, Saga consumer                            |
| notification-service | RabbitMQ             | Nodemailer, DLQ consumer                          |

## Getting Started

Prerequisites: Node 20, pnpm 8+, Docker and Docker Compose.

```bash
cp .env.example .env
pnpm install
pnpm docker:up
```

Services run TypeORM migrations on startup. Use `pnpm db:migrate` manually when running services outside Docker with host-reachable database URLs.
Use `pnpm db:seed` for demo users/rules when your local env points to host-reachable database URLs.
`pnpm docker:down` removes containers and volumes, so local PostgreSQL data is reset.

| URL                    | Purpose          |
| ---------------------- | ---------------- |
| http://localhost:3000  | API Gateway      |
| http://localhost:3001  | Auth Service     |
| http://localhost:3002  | Ride Service     |
| http://localhost:3003  | Location Service |
| http://localhost:3004  | Pricing Service  |
| http://localhost:3006  | Payment Service  |
| http://localhost:15672 | RabbitMQ UI      |
| http://localhost:16686 | Jaeger UI        |

Notification service listens on port `3005` inside the Docker network but is not published to the host by default.

## Distributed Patterns

Outbox flow:

```text
HTTP command -> DB transaction updates ride + inserts outbox row -> cron publishes to RabbitMQ -> marks published
```

Saga choreography:

```text
ride.completed -> payment-service -> payment.processed/payment.failed -> ride state updates
```

Circuit breaker:

```text
gateway proxy -> closed -> downstream errors -> open -> 503 fallback -> half-open probe -> closed
```

## API Reference

- API Gateway Swagger: http://localhost:3000/api/docs
- Auth Swagger: http://localhost:3001/api/docs
- Ride Swagger: http://localhost:3002/api/docs
- Location Swagger: http://localhost:3003/api/docs
- Pricing Swagger: http://localhost:3004/api/docs
- Payment Swagger: http://localhost:3006/api/docs

Versioned APIs are available through `/api/v1/...` alongside the original `/api/...` routes.
Swagger docs include request/response examples for the gateway-proxied auth, ride lifecycle, pricing and location routes.

Common gateway flow:

```text
POST /api/v1/auth/register
POST /api/v1/auth/login
PUT  /api/v1/auth/drivers/availability
POST /api/v1/locations/drivers/:driverId
GET  /api/v1/pricing/estimate
POST /api/v1/rides
PATCH /api/v1/rides/:id/arrive
PATCH /api/v1/rides/:id/start
PATCH /api/v1/rides/:id/complete
```

## Running Tests

```bash
pnpm lint
pnpm test
pnpm turbo run test -- --coverage
pnpm typecheck
npm run format
```

`npm run format` runs Prettier only. Use `npm run typecheck` or `pnpm typecheck` separately for TypeScript validation.

## Smoke Test

After `pnpm docker:up`, verify the stack with:

```bash
docker compose ps
```

All backend services should be healthy. A successful end-to-end smoke path is:

```text
rider register/login -> driver register/login -> driver availability/location
-> nearby driver lookup -> pricing estimate -> ride request
-> arrive -> start -> complete -> payment processed
```

The payment service stores processed payments in `payment_db.payments` after consuming `ride.completed`.
