import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUpdatedAtToExamples1780099200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE examples
        ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE examples DROP COLUMN updated_at
    `);
  }
}
