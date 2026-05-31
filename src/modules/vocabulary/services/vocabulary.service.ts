import { AppDataSource } from '../../../config/database.config';
import { Word, LanguageCode } from '../entities/word.entity';
import { VerbDetails } from '../entities/verb-details.entity';
import { Example } from '../entities/example.entity';
import { CreateWordDto } from '../dtos/create-word.dto';
import { UpdateWordDto } from '../dtos/update-word.dto';
import { CreateVerbDetailsDto } from '../dtos/create-verb-details.dto';
import { UpdateVerbDetailsDto } from '../dtos/update-verb-details.dto';
import { CreateExampleDto } from '../dtos/create-example.dto';
import { UpdateExampleDto } from '../dtos/update-example.dto';
import { SetAudioDto } from '../dtos/set-audio.dto';

// ── Repository getters (lazy so they're resolved after DB initialises) ────────

class VocabularyService {
  private get wordRepo() { return AppDataSource.getRepository(Word); }
  private get verbRepo() { return AppDataSource.getRepository(VerbDetails); }
  private get exRepo()   { return AppDataSource.getRepository(Example); }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private notFound(entity: string): never {
    throw Object.assign(new Error(`${entity} not found`), { statusCode: 404 });
  }

  /** Load a word by id, throw 404 if missing. */
  private async requireWord(id: string): Promise<Word> {
    const word = await this.wordRepo.findOne({ where: { id } });
    if (!word) this.notFound('Word');
    return word!;
  }

  /**
   * Load an example by id. When wordId is provided, also verifies the
   * word↔example link exists in the join table (throws 404 if the link
   * is missing, not just the example row).
   */
  private async requireExample(exId: string, wordId?: string): Promise<Example> {
    const qb = this.exRepo
      .createQueryBuilder('example')
      .where('example.id = :exId', { exId });
    if (wordId) {
      qb.innerJoin('example.words', 'word', 'word.id = :wordId', { wordId });
    }
    const example = await qb.getOne();
    if (!example) this.notFound('Example');
    return example!;
  }

  // ── Words ───────────────────────────────────────────────────────────────────

  async listWords(filters: {
    level?:              string;
    pos?:                string;
    q?:                  string;
    exampleId?:          string;
    noAudio?:            boolean;
    noTranslationEn?:    boolean;
    noTranslationRu?:    boolean;
    noTranslationFa?:    boolean;
    noTranslationAr?:    boolean;
    updatedAfter?:       Date;
    updatedBefore?:      Date;
    audioCreatedAfter?:  Date;
    audioCreatedBefore?: Date;
    page?:               number;
    limit?:              number;
  }) {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const qb = this.wordRepo
      .createQueryBuilder('w')
      .orderBy('w.word', 'ASC')
      .take(limit)
      .skip((page - 1) * limit);

    // ── Existing filters ────────────────────────────────────────────────────────
    if (filters.level) qb.andWhere('w.level = :level', { level: filters.level });
    if (filters.pos)   qb.andWhere('w.partOfSpeech = :pos', { pos: filters.pos });
    if (filters.q) {
      // Uses the IDX_words_word_trgm GIN index for fast partial umlaut-insensitive search
      qb.andWhere(
        `immutable_unaccent(lower(w.word)) LIKE '%' || immutable_unaccent(lower(:q)) || '%'`,
        { q: filters.q },
      );
    }

    // ── New filters ─────────────────────────────────────────────────────────────
    if (filters.exampleId) {
      // Word owns the join table (@JoinTable on Word) — join via ORM relation
      qb.innerJoin('w.examples', 'example', 'example.id = :exampleId', { exampleId: filters.exampleId });
    }
    if (filters.noAudio)         qb.andWhere('w.audioFileUrl IS NULL');
    if (filters.noTranslationEn) qb.andWhere('w.translationEn IS NULL');
    if (filters.noTranslationRu) qb.andWhere('w.translationRu IS NULL');
    if (filters.noTranslationFa) qb.andWhere('w.translationFa IS NULL');
    if (filters.noTranslationAr) qb.andWhere('w.translationAr IS NULL');

    if (filters.updatedAfter)
      qb.andWhere('w.updatedAt > :updatedAfter', { updatedAfter: filters.updatedAfter });
    if (filters.updatedBefore)
      qb.andWhere('w.updatedAt < :updatedBefore', { updatedBefore: filters.updatedBefore });

    if (filters.audioCreatedAfter)
      qb.andWhere('w.audioCreatedAt > :audioCreatedAfter', { audioCreatedAfter: filters.audioCreatedAfter });
    if (filters.audioCreatedBefore)
      qb.andWhere('w.audioCreatedAt < :audioCreatedBefore', { audioCreatedBefore: filters.audioCreatedBefore });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async createWord(dto: CreateWordDto): Promise<Word> {
    // Check for duplicate word + partOfSpeech combination
    const existing = await this.wordRepo.findOne({
      where: { word: dto.word, partOfSpeech: dto.partOfSpeech },
    });
    if (existing) {
      throw Object.assign(
        new Error(`Word "${dto.word}" with part of speech "${dto.partOfSpeech}" already exists`),
        { statusCode: 409 },
      );
    }

    const word = this.wordRepo.create({
      word:           dto.word,
      partOfSpeech:   dto.partOfSpeech,
      gender:         dto.gender        ?? null,
      plural:         dto.plural        ?? null,
      level:          dto.level,
      translationFa:  dto.translationFa ?? null,
      translationEn:  dto.translationEn ?? null,
      translationRu:  dto.translationRu ?? null,
      translationAr:  dto.translationAr ?? null,
      audioFileUrl:   dto.audioFileUrl  ?? null,
      audioCreatedAt: dto.audioFileUrl  ? new Date() : null,
    });
    return this.wordRepo.save(word);
  }

  async getWordById(id: string): Promise<Word> {
    const word = await this.wordRepo.findOne({
      where: { id },
      relations: ['verbDetails', 'examples'],
    });
    if (!word) this.notFound('Word');
    return word!;
  }

  async updateWord(id: string, dto: UpdateWordDto): Promise<Word> {
    const word = await this.requireWord(id);
    Object.assign(word, {
      ...(dto.word          !== undefined && { word:          dto.word }),
      ...(dto.partOfSpeech  !== undefined && { partOfSpeech:  dto.partOfSpeech }),
      ...(dto.gender        !== undefined && { gender:        dto.gender }),
      ...(dto.plural        !== undefined && { plural:        dto.plural }),
      ...(dto.level         !== undefined && { level:         dto.level }),
      ...(dto.translationFa !== undefined && { translationFa: dto.translationFa }),
      ...(dto.translationEn !== undefined && { translationEn: dto.translationEn }),
      ...(dto.translationRu !== undefined && { translationRu: dto.translationRu }),
      ...(dto.translationAr !== undefined && { translationAr: dto.translationAr }),
      ...(dto.audioFileUrl  !== undefined && {
        audioFileUrl:   dto.audioFileUrl,
        audioCreatedAt: dto.audioFileUrl ? new Date() : null,
      }),
    });
    return this.wordRepo.save(word);
  }

  async deleteWord(id: string): Promise<void> {
    const result = await this.wordRepo.delete(id);
    if (!result.affected) this.notFound('Word');
  }

  // ── Verb Details ────────────────────────────────────────────────────────────

  async createVerbDetails(wordId: string, dto: CreateVerbDetailsDto): Promise<VerbDetails> {
    await this.requireWord(wordId);

    const existing = await this.verbRepo.findOne({ where: { wordId } });
    if (existing) {
      throw Object.assign(
        new Error('Verb details already exist for this word. Use PATCH to update.'),
        { statusCode: 409 },
      );
    }

    const details = this.verbRepo.create({ wordId, ...dto });
    return this.verbRepo.save(details);
  }

  async updateVerbDetails(wordId: string, dto: UpdateVerbDetailsDto): Promise<VerbDetails> {
    const details = await this.verbRepo.findOne({ where: { wordId } });
    if (!details) this.notFound('Verb details');

    Object.assign(details!, dto);
    return this.verbRepo.save(details!);
  }

  // ── Word Translations (inline columns on words) ─────────────────────────────

  /** Column name for each language code on the Word entity. */
  private readonly langCol: Record<LanguageCode, 'translationFa' | 'translationEn' | 'translationRu' | 'translationAr'> = {
    [LanguageCode.FA]: 'translationFa',
    [LanguageCode.EN]: 'translationEn',
    [LanguageCode.RU]: 'translationRu',
    [LanguageCode.AR]: 'translationAr',
  };

  /**
   * Set (or optionally guard against overwriting) a single inline translation
   * column on the word row. Returns the updated Word.
   *
   * @param failIfExists - When true, throws 409 if the column is already non-null
   *                       (used by the POST endpoint to preserve add-only semantics).
   */
  async setWordTranslation(
    wordId: string,
    lang: LanguageCode,
    translation: string,
    failIfExists = false,
  ): Promise<Word> {
    const word = await this.requireWord(wordId);
    const col = this.langCol[lang];

    if (failIfExists && word[col] !== null) {
      throw Object.assign(
        new Error(`Translation for language "${lang}" already exists. Use PATCH to update.`),
        { statusCode: 409 },
      );
    }

    word[col] = translation;
    return this.wordRepo.save(word);
  }

  /** Nulls out a single inline translation column. */
  async clearWordTranslation(wordId: string, lang: LanguageCode): Promise<void> {
    const col = this.langCol[lang];
    const result = await this.wordRepo.update(wordId, { [col]: null } as Partial<Word>);
    if (!result.affected) this.notFound('Word');
  }

  // ── Examples ────────────────────────────────────────────────────────────────

  /**
   * Global paginated list of all examples, optionally filtered by a
   * umlaut-insensitive partial match on the sentence text.
   * Note: no trigram index on examples.sentence yet — add a GIN index
   *       migration if full-text search performance becomes a concern.
   */
  async listAllExamples(filters: {
    q?:                  string;
    wordId?:             string;
    noAudio?:            boolean;
    noTranslationEn?:    boolean;
    noTranslationRu?:    boolean;
    noTranslationFa?:    boolean;
    noTranslationAr?:    boolean;
    updatedAfter?:       Date;
    updatedBefore?:      Date;
    audioCreatedAfter?:  Date;
    audioCreatedBefore?: Date;
    page?:               number;
    limit?:              number;
  }) {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const qb = this.exRepo
      .createQueryBuilder('example')
      .orderBy('example.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (filters.wordId) {
      qb.innerJoin('example.words', 'word', 'word.id = :wordId', { wordId: filters.wordId });
    }
    if (filters.q) {
      qb.andWhere(
        `immutable_unaccent(lower(example.sentence)) LIKE '%' || immutable_unaccent(lower(:q)) || '%'`,
        { q: filters.q },
      );
    }
    if (filters.noAudio)         qb.andWhere('example.audioFileUrl IS NULL');
    if (filters.noTranslationEn) qb.andWhere('example.translationEn IS NULL');
    if (filters.noTranslationRu) qb.andWhere('example.translationRu IS NULL');
    if (filters.noTranslationFa) qb.andWhere('example.translationFa IS NULL');
    if (filters.noTranslationAr) qb.andWhere('example.translationAr IS NULL');

    if (filters.updatedAfter)
      qb.andWhere('example.updatedAt > :updatedAfter', { updatedAfter: filters.updatedAfter });
    if (filters.updatedBefore)
      qb.andWhere('example.updatedAt < :updatedBefore', { updatedBefore: filters.updatedBefore });

    if (filters.audioCreatedAfter)
      qb.andWhere('example.audioCreatedAt > :audioCreatedAfter', { audioCreatedAfter: filters.audioCreatedAfter });
    if (filters.audioCreatedBefore)
      qb.andWhere('example.audioCreatedAt < :audioCreatedBefore', { audioCreatedBefore: filters.audioCreatedBefore });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getExampleById(exId: string): Promise<Example> {
    const example = await this.exRepo.findOne({ where: { id: exId } });
    if (!example) this.notFound('Example');
    return example!;
  }

  async updateExample(exId: string, dto: UpdateExampleDto): Promise<Example> {
    const example = await this.requireExample(exId);
    Object.assign(example, {
      ...(dto.sentence      !== undefined && { sentence:      dto.sentence }),
      ...(dto.translationFa !== undefined && { translationFa: dto.translationFa }),
      ...(dto.translationEn !== undefined && { translationEn: dto.translationEn }),
      ...(dto.translationRu !== undefined && { translationRu: dto.translationRu }),
      ...(dto.translationAr !== undefined && { translationAr: dto.translationAr }),
    });
    return this.exRepo.save(example);
  }

  async createExample(dto: CreateExampleDto): Promise<Example> {
    return this.exRepo.save(this.exRepo.create({
      sentence:      dto.sentence,
      translationFa: dto.translationFa ?? null,
      translationEn: dto.translationEn ?? null,
      translationRu: dto.translationRu ?? null,
      translationAr: dto.translationAr ?? null,
    }));
  }

  /** Detaches the example from this word only — does NOT delete the example row. */
  async detachExample(wordId: string, exId: string): Promise<void> {
    await this.requireExample(exId, wordId); // 404 if link doesn't exist
    await this.wordRepo
      .createQueryBuilder()
      .relation('examples')
      .of(wordId)
      .remove(exId);
  }

  /** Links an already-existing example to an additional word. */
  async linkExample(wordId: string, exId: string): Promise<void> {
    await this.requireWord(wordId);
    const example = await this.exRepo.findOne({ where: { id: exId } });
    if (!example) this.notFound('Example');
    // 409 if already linked
    const alreadyLinked = await this.exRepo
      .createQueryBuilder('example')
      .innerJoin('example.words', 'word', 'word.id = :wordId', { wordId })
      .where('example.id = :exId', { exId })
      .getCount();
    if (alreadyLinked > 0) {
      throw Object.assign(
        new Error('Example is already linked to this word'),
        { statusCode: 409 },
      );
    }
    await this.wordRepo
      .createQueryBuilder()
      .relation('examples')
      .of(wordId)
      .add(exId);
  }

  /** Permanently deletes the example row and all its children via cascade. */
  async deleteExamplePermanently(exId: string): Promise<void> {
    const result = await this.exRepo.delete(exId);
    if (!result.affected) this.notFound('Example');
  }

  // ── Audio (inline columns on word / example) ────────────────────────────────

  async setWordAudio(wordId: string, dto: SetAudioDto): Promise<Word> {
    const word = await this.requireWord(wordId);
    word.audioFileUrl   = dto.fileUrl;
    word.audioCreatedAt = new Date();
    return this.wordRepo.save(word);
  }

  async clearWordAudio(wordId: string): Promise<Word> {
    const word = await this.requireWord(wordId);
    word.audioFileUrl   = null;
    word.audioCreatedAt = null;
    return this.wordRepo.save(word);
  }

  async setExampleAudio(wordId: string, exId: string, dto: SetAudioDto): Promise<Example> {
    const example = await this.requireExample(exId, wordId);
    example.audioFileUrl   = dto.fileUrl;
    example.audioCreatedAt = new Date();
    return this.exRepo.save(example);
  }

  async clearExampleAudio(wordId: string, exId: string): Promise<Example> {
    const example = await this.requireExample(exId, wordId);
    example.audioFileUrl   = null;
    example.audioCreatedAt = null;
    return this.exRepo.save(example);
  }
}

export const vocabularyService = new VocabularyService();
