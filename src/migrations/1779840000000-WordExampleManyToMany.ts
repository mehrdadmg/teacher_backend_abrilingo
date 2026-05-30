import { MigrationInterface, QueryRunner } from 'typeorm';

export class WordExampleManyToMany1779840000000 implements MigrationInterface {
  name = 'WordExampleManyToMany1779840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Create the join table ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE word_examples (
        word_id    UUID NOT NULL,
        example_id UUID NOT NULL,
        CONSTRAINT "PK_word_examples" PRIMARY KEY (word_id, example_id),
        CONSTRAINT "FK_word_examples_word"
          FOREIGN KEY (word_id) REFERENCES words(id)
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_word_examples_example"
          FOREIGN KEY (example_id) REFERENCES examples(id)
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_word_examples_word_id"    ON word_examples (word_id)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_word_examples_example_id" ON word_examples (example_id)
    `);

    // ── 2. Migrate existing word→example associations ─────────────────────────
    //    Do this BEFORE dropping the word_id column from examples.
    await queryRunner.query(`
      INSERT INTO word_examples (word_id, example_id)
      SELECT word_id, id FROM examples WHERE word_id IS NOT NULL
    `);

    // ── 3. Drop the old FK, index, and column from examples ──────────────────
    await queryRunner.query(`
      ALTER TABLE examples DROP CONSTRAINT "FK_examples_word"
    `);
    await queryRunner.query(`
      DROP INDEX "IDX_examples_word_id"
    `);
    await queryRunner.query(`
      ALTER TABLE examples DROP COLUMN word_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── 1. Re-add word_id column to examples ─────────────────────────────────
    //    Nullable first so we can backfill before setting NOT NULL.
    await queryRunner.query(`
      ALTER TABLE examples ADD COLUMN word_id UUID
    `);

    // ── 2. Backfill word_id from the join table ───────────────────────────────
    //    If an example is linked to multiple words, we pick an arbitrary one
    //    (MIN word_id) to satisfy the NOT NULL constraint being restored.
    await queryRunner.query(`
      UPDATE examples e
      SET    word_id = we.word_id
      FROM   (
        SELECT DISTINCT ON (example_id) example_id, word_id
        FROM   word_examples
        ORDER  BY example_id, word_id
      ) we
      WHERE  we.example_id = e.id
    `);

    // ── 3. Enforce NOT NULL and re-add FK + index ─────────────────────────────
    await queryRunner.query(`
      ALTER TABLE examples ALTER COLUMN word_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE examples
        ADD CONSTRAINT "FK_examples_word"
        FOREIGN KEY (word_id) REFERENCES words(id)
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_examples_word_id" ON examples (word_id)
    `);

    // ── 4. Drop the join table ────────────────────────────────────────────────
    await queryRunner.query(`DROP TABLE word_examples`);
  }
}
