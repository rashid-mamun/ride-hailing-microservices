import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRideSchema1710000000000 implements MigrationInterface {
    name = 'CreateRideSchema1710000000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."rides_status_enum" AS ENUM('requested', 'driver_matched', 'driver_arrived', 'in_progress', 'completed', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."rides_cancelledby_enum" AS ENUM('rider', 'driver', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."outbox_events_status_enum" AS ENUM('pending', 'published', 'failed');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "riderId" uuid NOT NULL,
        "driverId" uuid,
        "status" "public"."rides_status_enum" NOT NULL DEFAULT 'requested',
        "pickupAddress" character varying(255) NOT NULL,
        "pickupLat" numeric(10,7) NOT NULL,
        "pickupLng" numeric(10,7) NOT NULL,
        "dropoffAddress" character varying(255) NOT NULL,
        "dropoffLat" numeric(10,7) NOT NULL,
        "dropoffLng" numeric(10,7) NOT NULL,
        "estimatedFare" numeric(10,2) NOT NULL,
        "finalFare" numeric(10,2),
        "estimatedDistanceKm" numeric(8,2),
        "estimatedDurationMinutes" integer,
        "actualDistanceKm" numeric(8,2),
        "actualDurationMinutes" integer,
        "requestedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "matchedAt" TIMESTAMP,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "cancelledAt" TIMESTAMP,
        "cancellationReason" character varying(500),
        "cancelledBy" "public"."rides_cancelledby_enum",
        CONSTRAINT "PK_rides_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outbox_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "aggregateId" uuid NOT NULL,
        "aggregateType" character varying(50) NOT NULL,
        "eventType" character varying(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "public"."outbox_events_status_enum" NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "lastAttemptAt" TIMESTAMP,
        "publishedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_rides_riderId" ON "rides" ("riderId")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_rides_driverId" ON "rides" ("driverId")`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_outbox_pending" ON "outbox_events" ("status", "attempts", "createdAt")`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_outbox_pending"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_rides_driverId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_rides_riderId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "outbox_events"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "rides"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."outbox_events_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."rides_cancelledby_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."rides_status_enum"`);
    }
}
