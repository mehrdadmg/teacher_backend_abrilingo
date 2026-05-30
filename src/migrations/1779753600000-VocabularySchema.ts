import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the German vocabulary subsystem tables:
 *   words, verb_details, word_translations,
 *   examples, example_translations, audio_files
 *
 * Also installs:
 *   - pg_trgm and unaccent extensions
 *   - immutable_unaccent() wrapper (required for index expressions)
 *   - fn_set_updated_at() trigger function + trigger on `words`
 *   - 12 performance indexes (B-tree, GIN, partial)
 */
export class VocabularySchema1779753600000 implements MigrationInterface {
  name = 'VocabularySchema1779753600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Step 1: Extensions ───────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    // ── Step 2: ENUM types ───────────────────────────────────────
    await queryRunner.query(
      `CREATE TYPE "public"."gender_enum" AS ENUM ('m', 'f', 'n')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."level_enum" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."part_of_speech_enum" AS ENUM (
        'noun', 'verb', 'adjective', 'adverb',
        'preposition', 'conjunction', 'article',
        'pronoun', 'interjection', 'numeral'
      )`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."language_code_enum" AS ENUM ('fa', 'en', 'ru', 'ar')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."voice_type_enum" AS ENUM ('male', 'female', 'ai')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auxiliary_enum" AS ENUM ('haben', 'sein')`,
    );

    // ── Step 3a: Table — words (root) ────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "words" (
        "id"             UUID                        NOT NULL DEFAULT gen_random_uuid(),
        "word"           CHARACTER VARYING(255)      NOT NULL,
        "part_of_speech" "public"."part_of_speech_enum" NOT NULL,
        "gender"         "public"."gender_enum"      NULL,
        "plural"         CHARACTER VARYING(255)      NULL,
        "level"          "public"."level_enum"       NOT NULL,
        "created_at"     TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_words" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_words_word_pos" UNIQUE ("word", "part_of_speech"),
        CONSTRAINT "CHK_words_gender_for_nouns" CHECK (
          (part_of_speech = 'noun'  AND gender IS NOT NULL) OR
          (part_of_speech <> 'noun' AND gender IS NULL AND plural IS NULL)
        )
      )
    `);

    // ── Step 3b: Table — verb_details (FK → words) ───────────────
    await queryRunner.query(`
      CREATE TABLE "verb_details" (
        "id"                       UUID                        NOT NULL DEFAULT gen_random_uuid(),
        "word_id"                  UUID                        NOT NULL,
        "is_regular"               BOOLEAN                     NOT NULL DEFAULT TRUE,
        "present_third_person"     CHARACTER VARYING(100)      NULL,
        "praeteritum_third_person" CHARACTER VARYING(100)      NULL,
        "perfekt_auxiliary"        "public"."auxiliary_enum"   NULL,
        "perfect_participle"       CHARACTER VARYING(100)      NULL,
        "imperative_du"            CHARACTER VARYING(100)      NULL,
        "imperative_ihr"           CHARACTER VARYING(100)      NULL,
        "imperative_sie"           CHARACTER VARYING(100)      NULL,
        "reflexive_pronoun"        CHARACTER VARYING(20)       NULL,
        "created_at"               TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_verb_details" PRIMARY KEY ("id"),
        CONSTRAINT "FK_verb_details_word"
          FOREIGN KEY ("word_id") REFERENCES "words" ("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // ── Step 3c: Table — word_translations (FK → words) ─────────
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

    // ── Step 3d: Table — examples (FK → words) ───────────────────
    await queryRunner.query(`
      CREATE TABLE "examples" (
        "id"         UUID                     NOT NULL DEFAULT gen_random_uuid(),
        "word_id"    UUID                     NOT NULL,
        "sentence"   TEXT                     NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_examples" PRIMARY KEY ("id"),
        CONSTRAINT "FK_examples_word"
          FOREIGN KEY ("word_id") REFERENCES "words" ("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // ── Step 3e: Table — example_translations (FK → examples) ────
    await queryRunner.query(`
      CREATE TABLE "example_translations" (
        "id"            UUID                           NOT NULL DEFAULT gen_random_uuid(),
        "example_id"    UUID                           NOT NULL,
        "language_code" "public"."language_code_enum"  NOT NULL,
        "translation"   TEXT                           NOT NULL,
        "created_at"    TIMESTAMP WITH TIME ZONE       NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_example_translations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_example_translations_ex_lang" UNIQUE ("example_id", "language_code"),
        CONSTRAINT "FK_example_translations_example"
          FOREIGN KEY ("example_id") REFERENCES "examples" ("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // ── Step 3f: Table — audio_files (FK → words OR examples) ────
    // Dual-FK polymorphic association: exactly one of word_id / example_id
    // must be set. The CHECK constraint enforces this at the DB level.
    await queryRunner.query(`
      CREATE TABLE "audio_files" (
        "id"          UUID                        NOT NULL DEFAULT gen_random_uuid(),
        "word_id"     UUID                        NULL,
        "example_id"  UUID                        NULL,
        "voice_type"  "public"."voice_type_enum"  NOT NULL,
        "file_url"    TEXT                        NOT NULL,
        "duration_ms" INTEGER                     NULL,
        "created_at"  TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_audio_files" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_audio_duration_positive" CHECK (duration_ms > 0),
        CONSTRAINT "CHK_audio_one_owner" CHECK (
          (word_id IS NOT NULL AND example_id IS NULL) OR
          (word_id IS NULL     AND example_id IS NOT NULL)
        ),
        CONSTRAINT "FK_audio_files_word"
          FOREIGN KEY ("word_id") REFERENCES "words" ("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_audio_files_example"
          FOREIGN KEY ("example_id") REFERENCES "examples" ("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // ── Step 4: immutable_unaccent() wrapper ─────────────────────
    // unaccent() is STABLE by default; PostgreSQL requires IMMUTABLE
    // for functions used in index expressions. This thin wrapper
    // satisfies that requirement.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text)
      RETURNS text LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $$
        SELECT unaccent($1);
      $$
    `);

    // ── Step 5: Indexes ──────────────────────────────────────────

    // B-tree: exact umlaut-insensitive word lookup (ä→a, ö→o, ü→u, ß→ss)
    await queryRunner.query(`
      CREATE INDEX "IDX_words_word_unaccent"
        ON "words" USING btree (immutable_unaccent(lower(word)))
    `);

    // GIN trigram: partial / fuzzy word search (LIKE '%…%', similarity())
    await queryRunner.query(`
      CREATE INDEX "IDX_words_word_trgm"
        ON "words" USING gin (immutable_unaccent(lower(word)) gin_trgm_ops)
    `);

    // Composite: filter by CEFR level + part of speech ("all A1 nouns")
    await queryRunner.query(`
      CREATE INDEX "IDX_words_level_pos"
        ON "words" ("level", "part_of_speech")
    `);

    // FK lookup indexes (prevent sequential scans on joins)
    await queryRunner.query(`
      CREATE INDEX "IDX_verb_details_word_id"
        ON "verb_details" ("word_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_word_translations_word_id"
        ON "word_translations" ("word_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_word_translations_lang"
        ON "word_translations" ("language_code")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_examples_word_id"
        ON "examples" ("word_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_example_translations_example_id"
        ON "example_translations" ("example_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_example_translations_lang"
        ON "example_translations" ("language_code")
    `);

    // Partial indexes on audio_files (only rows with the matching owner type)
    await queryRunner.query(`
      CREATE INDEX "IDX_audio_files_word_id"
        ON "audio_files" ("word_id")
        WHERE word_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audio_files_example_id"
        ON "audio_files" ("example_id")
        WHERE example_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_audio_files_voice_type"
        ON "audio_files" ("voice_type")
    `);

    // ── Step 6: updated_at trigger function ──────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION fn_set_updated_at()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$
    `);

    // ── Step 7: Trigger on words ─────────────────────────────────
    await queryRunner.query(`
      CREATE TRIGGER trg_words_updated_at
        BEFORE UPDATE ON "words"
        FOR EACH ROW
        EXECUTE FUNCTION fn_set_updated_at()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Reverse Step 7: Drop trigger ─────────────────────────────
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_words_updated_at ON "words"`,
    );

    // ── Reverse Step 6: Drop trigger function ────────────────────
    await queryRunner.query(`DROP FUNCTION IF EXISTS fn_set_updated_at()`);

    // ── Reverse Step 5: Drop all indexes ─────────────────────────
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_audio_files_voice_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_audio_files_example_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_audio_files_word_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_example_translations_lang"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_example_translations_example_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_examples_word_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_word_translations_lang"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_word_translations_word_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_verb_details_word_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_words_level_pos"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_words_word_trgm"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "public"."IDX_words_word_unaccent"`,
    );

    // ── Reverse Step 4: Drop immutable_unaccent wrapper ──────────
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS immutable_unaccent(text)`,
    );

    // ── Reverse Step 3: Drop tables (reverse FK-dependency order) ─
    await queryRunner.query(`DROP TABLE IF EXISTS "audio_files"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "example_translations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "examples"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "word_translations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verb_details"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "words"`);

    // ── Reverse Step 2: Drop ENUM types ──────────────────────────
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."auxiliary_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."voice_type_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."language_code_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."part_of_speech_enum"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."gender_enum"`);

    // Extensions (unaccent, pg_trgm) are intentionally NOT dropped —
    // they may be used by other objects in the database.
  }
}
