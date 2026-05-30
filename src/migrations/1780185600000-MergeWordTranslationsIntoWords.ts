import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Merges the `word_translations` table into the `words` table by adding four
 * nullable TEXT columns: translation_fa, translation_en, translation_ru, translation_ar.
 *
 * Data is migrated from the separate rows and the `word_translations` table (along
 * with the now-unused `language_code_enum` PostgreSQL type) is dropped.
 *
 * Down: recreates `word_translations`, restores data, drops the four columns.
 */
export class MergeWordTranslationsIntoWords1780185600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add four nullable translation columns to words
    await queryRunner.query(`
      ALTER TABLE words
        ADD COLUMN translation_fa TEXT,
        ADD COLUMN translation_en TEXT,
        ADD COLUMN translation_ru TEXT,
        ADD COLUMN translation_ar TEXT
    `);

    // 2. Back-fill from word_translations (one correlated UPDATE per language)
    await queryRunner.query(`
      UPDATE words w
      SET translation_fa = (
        SELECT wt.translation FROM word_translations wt
        WHERE wt.word_id = w.id AND wt.language_code = 'fa'
        LIMIT 1
      )
    `);
    await queryRunner.query(`
      UPDATE words w
      SET translation_en = (
        SELECT wt.translation FROM word_translations wt
        WHERE wt.word_id = w.id AND wt.language_code = 'en'
        LIMIT 1
      )
    `);
    await queryRunner.query(`
      UPDATE words w
      SET translation_ru = (
        SELECT wt.translation FROM word_translations wt
        WHERE wt.word_id = w.id AND wt.language_code = 'ru'
        LIMIT 1
      )
    `);
    await queryRunner.query(`
      UPDATE words w
      SET translation_ar = (
        SELECT wt.translation FROM word_translations wt
        WHERE wt.word_id = w.id AND wt.language_code = 'ar'
        LIMIT 1
      )
    `);

    // 3. Drop word_translations (CASCADE removes FK constraint and its indexes)
    await queryRunner.query(`DROP TABLE word_translations`);

    // 4. Drop language_code_enum — no longer used by any table
    await queryRunner.query(`DROP TYPE "public"."language_code_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Recreate language_code_enum
    await queryRunner.query(
      `CREATE TYPE "public"."language_code_enum" AS ENUM ('fa', 'en', 'ru', 'ar')`,
    );

    // 2. Recreate word_translations with the original schema
    await queryRunner.query(`
      CREATE TABLE "word_translations" (
        "id"            UUID                           NOT NULL DEFAULT gen_random_uuid(),
        "word_id"       UUID                           NOT NULL,
        "language_code" "public"."language_code_enum"  NOT NULL,
        "translation"   TEXT                           NOT NULL,
        "notes"         TEXT                           NULL,
        "created_at"    TIMESTAMP WITH TIME ZONE       NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_word_translations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_word_translations_word_lang" UNIQUE ("word_id", "language_code"),
        CONSTRAINT "FK_word_translations_word"
          FOREIGN KEY ("word_id") REFERENCES "words" ("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // 3. Restore indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_word_translations_word_id" ON word_translations (word_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_word_translations_lang" ON word_translations (language_code)`,
    );

    // 4. Migrate data back from word columns → word_translations rows
    await queryRunner.query(`
      INSERT INTO word_translations (word_id, language_code, translation)
      SELECT id, 'fa', translation_fa FROM words WHERE translation_fa IS NOT NULL
      UNION ALL
      SELECT id, 'en', translation_en FROM words WHERE translation_en IS NOT NULL
      UNION ALL
      SELECT id, 'ru', translation_ru FROM words WHERE translation_ru IS NOT NULL
      UNION ALL
      SELECT id, 'ar', translation_ar FROM words WHERE translation_ar IS NOT NULL
    `);

    // 5. Drop the four translation columns from words
    await queryRunner.query(`
      ALTER TABLE words
        DROP COLUMN translation_fa,
        DROP COLUMN translation_en,
        DROP COLUMN translation_ru,
        DROP COLUMN translation_ar
    `);
  }
}
