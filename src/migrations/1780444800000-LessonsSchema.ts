import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonsSchema1780444800000 implements MigrationInterface {
  name = 'LessonsSchema1780444800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. lessons ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE lessons (
        id    SERIAL PRIMARY KEY,
        title VARCHAR NOT NULL,
        level VARCHAR NOT NULL
      )
    `);

    // ── 2. lesson_words (lessons ↔ words many-to-many) ────────────────────────
    await queryRunner.query(`
      CREATE TABLE lesson_words (
        id        SERIAL PRIMARY KEY,
        lesson_id INT  NOT NULL,
        word_id   UUID NOT NULL,
        CONSTRAINT "FK_lesson_words_lesson"
          FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_words_word"
          FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
        CONSTRAINT "UQ_lesson_words_lesson_word"
          UNIQUE (lesson_id, word_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_words_lesson_id" ON lesson_words (lesson_id)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_words_word_id" ON lesson_words (word_id)
    `);

    // ── 3. lesson_word_examples (lesson_words ↔ word_examples many-to-many) ──
    //    References word_examples(id) — not examples(id) — so that only
    //    examples already linked to the relevant word can be scoped into a lesson.
    await queryRunner.query(`
      CREATE TABLE lesson_word_examples (
        lesson_word_id  INT NOT NULL,
        word_example_id INT NOT NULL,
        CONSTRAINT "PK_lesson_word_examples"
          PRIMARY KEY (lesson_word_id, word_example_id),
        CONSTRAINT "FK_lesson_word_examples_lesson_word"
          FOREIGN KEY (lesson_word_id) REFERENCES lesson_words(id) ON DELETE CASCADE,
        CONSTRAINT "FK_lesson_word_examples_word_example"
          FOREIGN KEY (word_example_id) REFERENCES word_examples(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_word_examples_lw" ON lesson_word_examples (lesson_word_id)
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_lesson_word_examples_we" ON lesson_word_examples (word_example_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lesson_word_examples`);
    await queryRunner.query(`DROP TABLE IF EXISTS lesson_words`);
    await queryRunner.query(`DROP TABLE IF EXISTS lessons`);
  }
}
