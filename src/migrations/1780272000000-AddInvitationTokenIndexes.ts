import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvitationTokenIndexes1780272000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Speed up the "is there an active invite for this email?" lookup in createAndSend
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_invitation_tokens_email_is_used
        ON invitation_tokens(email, is_used)
    `);

    // Prevent two active (unused) invitations for the same email (closes race condition)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uidx_invitation_tokens_email_active
        ON invitation_tokens(email)
        WHERE is_used = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uidx_invitation_tokens_email_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_invitation_tokens_email_is_used`);
  }
}
