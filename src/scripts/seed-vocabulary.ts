import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../config/database.config';
import { Word, PartOfSpeech, Gender, Level, Auxiliary } from '../modules/vocabulary/entities/word.entity';
import { VerbDetails } from '../modules/vocabulary/entities/verb-details.entity';
import { Example } from '../modules/vocabulary/entities/example.entity';

// ── Fixed UUIDs — readable prefixes make grep / DB inspection easy ────────────
//   a… → words          b… → verb_details
//   d… → examples

const ID = {
  // words
  TISCH: 'a0000001-0000-0000-0000-000000000001',
  SEHEN: 'a0000002-0000-0000-0000-000000000002',
  // verb_details
  VD_SEHEN: 'b0000001-0000-0000-0000-000000000001',
  // examples
  EX_TISCH_1: 'd0000001-0000-0000-0000-000000000001',
  EX_TISCH_2: 'd0000002-0000-0000-0000-000000000002',
  EX_SEHEN_1: 'd0000003-0000-0000-0000-000000000003',
  EX_SEHEN_2: 'd0000004-0000-0000-0000-000000000004',
} as const;

// ── Seed logic ────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('[seed:vocabulary] Database connection established.');

  const wordRepo = AppDataSource.getRepository(Word);

  // ── Idempotency guard ───────────────────────────────────────────────────────
  // Both seed words must be present; a partial DB state (e.g. sehen deleted
  // after a previous run) should trigger a re-seed of the missing records.
  const [existingTisch, existingSehen] = await Promise.all([
    wordRepo.findOne({ where: { id: ID.TISCH } }),
    wordRepo.findOne({ where: { id: ID.SEHEN } }),
  ]);
  if (existingTisch && existingSehen) {
    console.log('[seed:vocabulary] Sample data already present — nothing to do.');
    console.log(`  Tisch : ${ID.TISCH}`);
    console.log(`  sehen : ${ID.SEHEN}`);
    return;
  }
  if (existingTisch || existingSehen) {
    console.log(
      '[seed:vocabulary] Partial seed detected — re-seeding missing records…\n' +
      `  Tisch present: ${Boolean(existingTisch)}   sehen present: ${Boolean(existingSehen)}`,
    );
  }

  console.log(
    '[seed:vocabulary] Seeding 2 words (with translations + audio), 1 verb detail, ' +
    '4 examples (2 with audio, translations inline)…',
  );

  // ── Atomic insert via QueryRunner transaction ───────────────────────────────
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // ── 1. Words (translations stored as inline columns) ──────────────────────
    const tisch = qr.manager.create(Word, {
      id:             ID.TISCH,
      word:           'Tisch',
      partOfSpeech:   PartOfSpeech.NOUN,
      gender:         Gender.M,
      plural:         'Tische',
      level:          Level.A1,
      translationFa:  'میز',
      translationEn:  'table',
      translationRu:  'стол',
      translationAr:  'طاولة',
      audioFileUrl:   'https://cdn.abrilingo.com/audio/de/words/tisch_ai.mp3',
      audioCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const sehen = qr.manager.create(Word, {
      id:             ID.SEHEN,
      word:           'sehen',
      partOfSpeech:   PartOfSpeech.VERB,
      gender:         null,
      plural:         null,
      level:          Level.A1,
      translationFa:  'دیدن',
      translationEn:  'to see',
      translationRu:  'видеть',
      translationAr:  'يرى / رأى',
      audioFileUrl:   'https://cdn.abrilingo.com/audio/de/words/sehen_male.mp3',
      audioCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await qr.manager.save(Word, [tisch, sehen]);

    // ── 2. Verb details — sehen ───────────────────────────────────────────────
    const sehenVerbDetails = qr.manager.create(VerbDetails, {
      id:                     ID.VD_SEHEN,
      wordId:                 ID.SEHEN,
      isRegular:              false,
      presentThirdPerson:     'sieht',
      praeteritumThirdPerson: 'sah',
      perfektAuxiliary:       Auxiliary.HABEN,
      perfectParticiple:      'gesehen',
      imperativeDu:           'Sieh!',
      imperativeIhr:          'Seht!',
      imperativeSie:          'Sehen Sie!',
      reflexivePronoun:       null,
    });

    await qr.manager.save(VerbDetails, sehenVerbDetails);

    // ── 3. Examples (M2M via word_examples; translations inlined as columns) ──
    const examples = qr.manager.create(Example, [
      // Tisch
      {
        id: ID.EX_TISCH_1, sentence: 'Der Tisch ist aus Holz.',
        translationFa:  'میز از چوب است.',
        translationEn:  'The table is made of wood.',
        translationRu:  'Стол сделан из дерева.',
        translationAr:  'الطاولة مصنوعة من الخشب.',
        audioFileUrl:   'https://cdn.abrilingo.com/audio/de/examples/tisch_ex1_female.mp3',
        audioCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: ID.EX_TISCH_2, sentence: 'Wir essen jeden Abend am Tisch.',
        translationFa: 'ما هر شب پشت میز غذا می‌خوریم.',
        translationEn: 'We eat at the table every evening.',
        translationRu: 'Мы каждый вечер едим за столом.',
        translationAr: 'نتناول الطعام على الطاولة كل مساء.',
      },
      // sehen
      {
        id: ID.EX_SEHEN_1, sentence: 'Ich sehe einen schönen Vogel im Garten.',
        translationFa:  'من یک پرنده زیبا در باغ می‌بینم.',
        translationEn:  'I see a beautiful bird in the garden.',
        translationRu:  'Я вижу красивую птицу в саду.',
        translationAr:  'أرى طائراً جميلاً في الحديقة.',
        audioFileUrl:   'https://cdn.abrilingo.com/audio/de/examples/sehen_ex1_ai.mp3',
        audioCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: ID.EX_SEHEN_2, sentence: 'Er hat das Buch noch nicht gesehen.',
        translationFa: 'او هنوز آن کتاب را ندیده است.',
        translationEn: 'He has not seen the book yet.',
        translationRu: 'Он ещё не видел эту книгу.',
        translationAr: 'لم يرَ الكتاب بعد.',
      },
    ]);

    await qr.manager.save(Example, examples);

    // ── 3b. word_examples join table rows ────────────────────────────────────
    await qr.query(
      `INSERT INTO word_examples (word_id, example_id) VALUES
        ($1, $3), ($1, $4), ($2, $5), ($2, $6)
       ON CONFLICT DO NOTHING`,
      [ID.TISCH, ID.SEHEN, ID.EX_TISCH_1, ID.EX_TISCH_2, ID.EX_SEHEN_1, ID.EX_SEHEN_2],
    );

    await qr.commitTransaction();
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
  }

  console.log('[seed:vocabulary] ✔ Done — vocabulary sample data inserted.');
  console.log('─────────────────────────────────────────');
  console.log(`  words    : Tisch (${ID.TISCH}) — fa/en/ru/ar + audio`);
  console.log(`             sehen (${ID.SEHEN}) — fa/en/ru/ar + audio`);
  console.log(`  verb_details : 1 (sehen)`);
  console.log(`  examples     : 4 (2 with audio, translations inline)`);
  console.log('─────────────────────────────────────────');
}

seed()
  .catch((err: unknown) => {
    console.error('[seed:vocabulary] FATAL —', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('[seed:vocabulary] Database connection closed.');
    }
  });
