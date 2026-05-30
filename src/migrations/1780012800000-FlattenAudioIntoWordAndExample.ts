import { MigrationInterface, QueryRunner } from 'typeorm';

export class FlattenAudioIntoWordAndExample1780012800000 implements MigrationInterface {

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add audio columns to words
    await queryRunner.query(`
      ALTER TABLE words
        ADD COLUMN audio_file_url   TEXT,
        ADD COLUMN audio_created_at TIMESTAMPTZ
    `);

    // 2. Add audio columns to examples
    await queryRunner.query(`
      ALTER TABLE examples
        ADD COLUMN audio_file_url   TEXT,
        ADD COLUMN audio_created_at TIMESTAMPTZ
    `);

    // 3. Back-fill words — pick the most recently added audio file per word
    await queryRunner.query(`
      UPDATE words w
      SET
        audio_file_url   = af.file_url,
        audio_created_at = af.created_at
      FROM (
        SELECT DISTINCT ON (word_id)
          word_id, file_url, created_at
        FROM audio_files
        WHERE word_id IS NOT NULL
        ORDER BY word_id, created_at DESC
      ) af
      WHERE w.id = af.word_id
    `);

    // 4. Back-fill examples — pick the most recently added audio file per example
    await queryRunner.query(`
      UPDATE examples e
      SET
        audio_file_url   = af.file_url,
        audio_created_at = af.created_at
      FROM (
        SELECT DISTINCT ON (example_id)
          example_id, file_url, created_at
        FROM audio_files
        WHERE example_id IS NOT NULL
        ORDER BY example_id, created_at DESC
      ) af
      WHERE e.id = af.example_id
    `);

    // 5. Drop audio_files (cascade removes all FK constraints, check constraints, and indexes)
    await queryRunner.query(`DROP TABLE audio_files`);

    // 6. Drop voice_type_enum (no longer referenced by any table)
    await queryRunner.query(`DROP TYPE IF EXISTS voice_type_enum`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-create voice_type_enum
    await queryRunner.query(`CREATE TYPE voice_type_enum AS ENUM ('male', 'female', 'ai')`);

    // 2. Re-create audio_files with original structure
    await queryRunner.query(`
      CREATE TABLE audio_files (
        id          UUID            NOT NULL DEFAULT uuid_generate_v4(),
        word_id     UUID,
        example_id  UUID,
        voice_type  voice_type_enum NOT NULL,
        file_url    TEXT            NOT NULL,
        duration_ms INTEGER,
        created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
        CONSTRAINT "PK_audio_files"              PRIMARY KEY (id),
        CONSTRAINT "FK_audio_files_word"         FOREIGN KEY (word_id)    REFERENCES words(id)    ON DELETE CASCADE,
        CONSTRAINT "FK_audio_files_example"      FOREIGN KEY (example_id) REFERENCES examples(id) ON DELETE CASCADE,
        CONSTRAINT "CHK_audio_one_owner"         CHECK (
          (word_id IS NOT NULL AND example_id IS NULL) OR
          (word_id IS NULL    AND example_id IS NOT NULL)
        ),
        CONSTRAINT "CHK_audio_duration_positive" CHECK (duration_ms > 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audio_files_word_id" ON audio_files (word_id) WHERE word_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audio_files_example_id" ON audio_files (example_id) WHERE example_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audio_files_voice_type" ON audio_files (voice_type)`,
    );

    // 3. Migrate data back (voice_type unknown — default to 'ai')
    await queryRunner.query(`
      INSERT INTO audio_files (word_id, example_id, voice_type, file_url, created_at)
      SELECT id, NULL, 'ai'::voice_type_enum, audio_file_url,
             COALESCE(audio_created_at, NOW())
      FROM words
      WHERE audio_file_url IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO audio_files (word_id, example_id, voice_type, file_url, created_at)
      SELECT NULL, id, 'ai'::voice_type_enum, audio_file_url,
             COALESCE(audio_created_at, NOW())
      FROM examples
      WHERE audio_file_url IS NOT NULL
    `);

    // 4. Drop the flat audio columns
    await queryRunner.query(`
      ALTER TABLE words
        DROP COLUMN audio_file_url,
        DROP COLUMN audio_created_at
    `);
    await queryRunner.query(`
      ALTER TABLE examples
        DROP COLUMN audio_file_url,
        DROP COLUMN audio_created_at
    `);
  }
}
