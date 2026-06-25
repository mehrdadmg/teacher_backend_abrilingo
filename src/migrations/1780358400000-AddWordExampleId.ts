import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWordExampleId1780358400000 implements MigrationInterface {
  name = 'AddWordExampleId1780358400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Drop existing composite primary key ───────────────────────────────
    await queryRunner.query(`
      ALTER TABLE word_examples DROP CONSTRAINT "PK_word_examples"
    `);

    // ── 2. Add SERIAL id column (existing rows receive auto-assigned values) ─
    await queryRunner.query(`
      ALTER TABLE word_examples ADD COLUMN id SERIAL
    `);

    // ── 3. Make id the new primary key ───────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE word_examples ADD CONSTRAINT "PK_word_examples_id" PRIMARY KEY (id)
    `);

    // ── 4. Restore uniqueness for (word_id, example_id) ─────────────────────
    //    The TypeORM @JoinTable still relies on the pair being unique; this
    //    constraint preserves that guarantee without needing a composite PK.
    await queryRunner.query(`
      ALTER TABLE word_examples
        ADD CONSTRAINT "UQ_word_examples_word_example" UNIQUE (word_id, example_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order: remove the new constraints/column, restore composite PK.
    // Any tables that reference word_examples(id) (e.g. lesson_word_examples)
    // must be reverted before this migration is rolled back.

    await queryRunner.query(`
      ALTER TABLE word_examples DROP CONSTRAINT "UQ_word_examples_word_example"
    `);
    await queryRunner.query(`
      ALTER TABLE word_examples DROP CONSTRAINT "PK_word_examples_id"
    `);
    await queryRunner.query(`
      ALTER TABLE word_examples DROP COLUMN id
    `);
    await queryRunner.query(`
      ALTER TABLE word_examples
        ADD CONSTRAINT "PK_word_examples" PRIMARY KEY (word_id, example_id)
    `);
  }
}
