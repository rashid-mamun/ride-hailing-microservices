import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixRefreshTokenConstraints1710000000001 implements MigrationInterface {
    name = 'FixRefreshTokenConstraints1710000000001';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        FOR constraint_name IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
          WHERE nsp.nspname = 'public'
            AND rel.relname = 'refresh_tokens'
            AND con.contype = 'u'
            AND con.conname <> 'UQ_refresh_tokens_token'
        LOOP
          EXECUTE format('ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS %I', constraint_name);
        END LOOP;
      END $$;
    `);
        await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_userId_active"
      ON "refresh_tokens" ("userId", "isRevoked")
    `);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_refresh_tokens_userId_active"`);
    }
}
