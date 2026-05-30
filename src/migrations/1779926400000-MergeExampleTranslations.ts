import { MigrationInterface, QueryRunner } from 'typeorm';

export class MergeExampleTranslations1779926400000 implements MigrationInterface {
  name = 'MergeExampleTranslations1779926400000';

  // ── up: merge example_translations into examples as flat columns ─────────────

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add four nullable translation columns to examples
    await queryRunner.query(`
      ALTER TABLE examples
        ADD COLUMN translation_fa TEXT,
        ADD COLUMN translation_en TEXT,
        ADD COLUMN translation_ru TEXT,
        ADD COLUMN translation_ar TEXT
    `);

    // 2. Back-fill from example_translations
    await queryRunner.query(`
      UPDATE examples e
      SET translation_fa = et.translation
      FROM example_translations et
      WHERE et.example_id = e.id AND et.language_code = 'fa'
    `);
    await queryRunner.query(`
      UPDATE examples e
      SET translation_en = et.translation
      FROM example_translations et
      WHERE et.example_id = e.id AND et.language_code = 'en'
    `);
    await queryRunner.query(`
      UPDATE examples e
      SET translation_ru = et.translation
      FROM example_translations et
      WHERE et.example_id = e.id AND et.language_code = 'ru'
    `);
    await queryRunner.query(`
      UPDATE examples e
      SET translation_ar = et.translation
      FROM example_translations et
      WHERE et.example_id = e.id AND et.language_code = 'ar'
    `);

    // 3. Drop example_translations — CASCADE removes FK, unique, and indexes
    await queryRunner.query(`DROP TABLE example_translations`);
  }

  // ── down: restore example_translations table from flat columns ───────────────

  async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-create example_translations with all original constraints and indexes
    await queryRunner.query(`
      CREATE TABLE example_translations (
        id            UUID        NOT NULL DEFAULT uuid_generate_v4(),
        example_id    UUID        NOT NULL,
        language_code language_code_enum NOT NULL,
        translation   TEXT        NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_example_translations"
          PRIMARY KEY (id),
        CONSTRAINT "UQ_example_translations_ex_lang"
          UNIQUE (example_id, language_code),
        CONSTRAINT "FK_example_translations_example"
          FOREIGN KEY (example_id) REFERENCES examples(id)
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_example_translations_example_id" ON example_translations (example_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_example_translations_lang" ON example_translations (language_code)`,
    );

    // 2. Migrate data back: columns → rows
    await queryRunner.query(`
      INSERT INTO example_translations (example_id, language_code, translation)
      SELECT id, 'fa', translation_fa FROM examples WHERE translation_fa IS NOT NULL
      UNION ALL
      SELECT id, 'en', translation_en FROM examples WHERE translation_en IS NOT NULL
      UNION ALL
      SELECT id, 'ru', translation_ru FROM examples WHERE translation_ru IS NOT NULL
      UNION ALL
      SELECT id, 'ar', translation_ar FROM examples WHERE translation_ar IS NOT NULL
    `);

    // 3. Drop the four translation columns from examples
    await queryRunner.query(`
      ALTER TABLE examples
        DROP COLUMN translation_fa,
        DROP COLUMN translation_en,
        DROP COLUMN translation_ru,
        DROP COLUMN translation_ar
    `);
  }
}
