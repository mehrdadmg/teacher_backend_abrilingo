import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Lesson } from './lesson.entity';
import { LessonWordExample } from './lesson-word-example.entity';
import { Word } from '../../vocabulary/entities/word.entity';

@Entity('lesson_words')
export class LessonWord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lesson_id' })
  lessonId: number;

  @Column({ name: 'word_id', type: 'uuid' })
  wordId: string;

  @ManyToOne(() => Lesson, (l) => l.lessonWords, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @ManyToOne(() => Word)
  @JoinColumn({ name: 'word_id' })
  word: Word;

  @OneToMany(() => LessonWordExample, (lwe) => lwe.lessonWord)
  lessonWordExamples: LessonWordExample[];
}
