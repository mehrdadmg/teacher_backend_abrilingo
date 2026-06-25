import { Entity, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LessonWord } from './lesson-word.entity';

@Entity('lesson_word_examples')
export class LessonWordExample {
  @PrimaryColumn({ name: 'lesson_word_id', type: 'int' })
  lessonWordId: number;

  // References word_examples(id) — no TypeORM relation to avoid conflicting
  // with the existing Word ↔ Example @JoinTable that also manages that table.
  @PrimaryColumn({ name: 'word_example_id', type: 'int' })
  wordExampleId: number;

  @ManyToOne(() => LessonWord, (lw) => lw.lessonWordExamples, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_word_id' })
  lessonWord: LessonWord;
}
