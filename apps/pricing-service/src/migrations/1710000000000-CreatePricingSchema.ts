import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePricingSchema1710000000000 implements MigrationInterface {
    name = 'CreatePricingSchema1710000000000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pricing_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "baseFare" numeric(10,2) NOT NULL DEFAULT '30',
        "perKmRate" numeric(10,2) NOT NULL DEFAULT '12',
        "perMinuteRate" numeric(10,2) NOT NULL DEFAULT '1.5',
        "minimumFare" numeric(10,2) NOT NULL DEFAULT '50',
        "surgeMultiplier" numeric(4,2) NOT NULL DEFAULT '1',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pricing_rules_id" PRIMARY KEY ("id")
      )
    `);
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_pricing_rules_active" ON "pricing_rules" ("isActive")`,
        );
        await queryRunner.query(
            `INSERT INTO "pricing_rules" ("name")
             SELECT 'Default Dhaka Rule'
             WHERE NOT EXISTS (SELECT 1 FROM "pricing_rules" WHERE "name" = 'Default Dhaka Rule')`,
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_pricing_rules_active"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "pricing_rules"`);
    }
}
