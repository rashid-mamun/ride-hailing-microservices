import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuthSchema1710000000000 implements MigrationInterface {
    name = 'CreateAuthSchema1710000000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`
      DO $$
      BEGIN
        CREATE TYPE "public"."users_role_enum" AS ENUM('rider', 'driver', 'admin');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "passwordHash" character varying(255) NOT NULL,
        "role" "public"."users_role_enum" NOT NULL DEFAULT 'rider',
        "firstName" character varying(100) NOT NULL,
        "lastName" character varying(100) NOT NULL,
        "phoneNumber" character varying(20),
        "isActive" boolean NOT NULL DEFAULT true,
        "isEmailVerified" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_phoneNumber" UNIQUE ("phoneNumber"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying(500) NOT NULL,
        "userId" uuid NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "isRevoked" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_refresh_tokens_token" UNIQUE ("token"),
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "drivers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "vehicleModel" character varying(100) NOT NULL,
        "vehiclePlate" character varying(20) NOT NULL,
        "isAvailable" boolean NOT NULL DEFAULT false,
        "currentLat" numeric(10,7),
        "currentLng" numeric(10,7),
        "rating" numeric(3,2) NOT NULL DEFAULT '5.00',
        "totalRides" integer NOT NULL DEFAULT 0,
        CONSTRAINT "UQ_drivers_userId" UNIQUE ("userId"),
        CONSTRAINT "UQ_drivers_vehiclePlate" UNIQUE ("vehiclePlate"),
        CONSTRAINT "PK_drivers_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_drivers_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "drivers"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_role_enum"`);
    }
}
