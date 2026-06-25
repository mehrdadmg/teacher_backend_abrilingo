import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { LessonWord } from './lesson-word.entity';

@Entity('lessons')
export class Lesson {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  level: string;

  @OneToMany(() => LessonWord, (lw) => lw.lesson)
  lessonWords: LessonWord[];
}
