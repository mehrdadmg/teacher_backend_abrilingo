import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
} from 'typeorm';
import { Word } from './word.entity';

@Entity('examples')
export class Example {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  sentence: string;

  @Column({ name: 'translation_fa', type: 'text', nullable: true })
  translationFa: string | null;

  @Column({ name: 'translation_en', type: 'text', nullable: true })
  translationEn: string | null;

  @Column({ name: 'translation_ru', type: 'text', nullable: true })
  translationRu: string | null;

  @Column({ name: 'translation_ar', type: 'text', nullable: true })
  translationAr: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Inverse side of the M2M — @JoinTable lives on Word
  @ManyToMany(() => Word, (w) => w.examples)
  words: Word[];

  @Column({ name: 'audio_file_url', type: 'text', nullable: true })
  audioFileUrl: string | null;

  @Column({ name: 'audio_created_at', type: 'timestamptz', nullable: true })
  audioCreatedAt: Date | null;
}
