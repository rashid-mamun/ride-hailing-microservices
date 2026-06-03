import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePayments1710000000000 implements MigrationInterface {
    name = 'CreatePayments1710000000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(
            `CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'processed', 'failed')`,
        );
        await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rideId" uuid NOT NULL,
        "riderId" uuid NOT NULL,
        "driverId" uuid NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'BDT',
        "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending',
        "transactionId" character varying(100) NOT NULL,
        "failureReason" character varying(500),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_payments_transactionId" UNIQUE ("transactionId"),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(`CREATE INDEX "IDX_payments_rideId" ON "payments" ("rideId")`);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_payments_rideId"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    }
}
