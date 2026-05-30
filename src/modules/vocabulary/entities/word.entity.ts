import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { VerbDetails } from './verb-details.entity';
import { Example } from './example.entity';

// ── Shared ENUM definitions ──────────────────────────────────────────────────
// Defined here and re-exported so all vocabulary entities import from one place.
// The enumName values must match the PostgreSQL ENUM type names created in the
// VocabularySchema migration.

export enum Gender {
  M = 'm',
  F = 'f',
  N = 'n',
}

export enum Level {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2',
}

export enum PartOfSpeech {
  NOUN        = 'noun',
  VERB        = 'verb',
  ADJECTIVE   = 'adjective',
  ADVERB      = 'adverb',
  PREPOSITION = 'preposition',
  CONJUNCTION = 'conjunction',
  ARTICLE     = 'article',
  PRONOUN     = 'pronoun',
  INTERJECTION = 'interjection',
  NUMERAL     = 'numeral',
}

export enum LanguageCode {
  FA = 'fa',
  EN = 'en',
  RU = 'ru',
  AR = 'ar',
}

export enum Auxiliary {
  HABEN = 'haben',
  SEIN  = 'sein',
}

// ── Entity ───────────────────────────────────────────────────────────────────

@Entity('words')
export class Word {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  word: string;

  @Column({
    name: 'part_of_speech',
    type: 'enum',
    enum: PartOfSpeech,
    enumName: 'part_of_speech_enum',
  })
  partOfSpeech: PartOfSpeech;

  @Column({
    type: 'enum',
    enum: Gender,
    enumName: 'gender_enum',
    nullable: true,
  })
  gender: Gender | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  plural: string | null;

  @Column({ type: 'enum', enum: Level, enumName: 'level_enum' })
  level: Level;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Inline translations (merged from the former word_translations table)
  @Column({ name: 'translation_fa', type: 'text', nullable: true })
  translationFa: string | null;

  @Column({ name: 'translation_en', type: 'text', nullable: true })
  translationEn: string | null;

  @Column({ name: 'translation_ru', type: 'text', nullable: true })
  translationRu: string | null;

  @Column({ name: 'translation_ar', type: 'text', nullable: true })
  translationAr: string | null;

  // Relations (not eager-loaded; loaded explicitly in service where needed)
  @OneToMany(() => VerbDetails, (vd) => vd.word)
  verbDetails: VerbDetails[];

  @ManyToMany(() => Example, (ex) => ex.words)
  @JoinTable({
    name:              'word_examples',
    joinColumn:        { name: 'word_id',    referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'example_id', referencedColumnName: 'id' },
  })
  examples: Example[];

  @Column({ name: 'audio_file_url', type: 'text', nullable: true })
  audioFileUrl: string | null;

  @Column({ name: 'audio_created_at', type: 'timestamptz', nullable: true })
  audioCreatedAt: Date | null;
}
