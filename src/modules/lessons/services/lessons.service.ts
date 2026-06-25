import { AppDataSource } from '../../../config/database.config';
import { Lesson } from '../entities/lesson.entity';
import { LessonWord } from '../entities/lesson-word.entity';
import { LessonWordExample } from '../entities/lesson-word-example.entity';
import { Word } from '../../vocabulary/entities/word.entity';
import { Example } from '../../vocabulary/entities/example.entity';
import { UpdateLessonDto } from '../dtos/update-lesson.dto';

export interface LessonWordDetail {
  lessonWordId: number;
  word: Word;
  examples: Example[];
}

export interface LessonDetail {
  id: number;
  title: string;
  level: string;
  words: LessonWordDetail[];
}

class LessonsService {
  private get lessonRepo()      { return AppDataSource.getRepository(Lesson); }
  private get lessonWordRepo()  { return AppDataSource.getRepository(LessonWord); }
  private get lessonWordExRepo(){ return AppDataSource.getRepository(LessonWordExample); }

  private notFound(entity: string): never {
    throw Object.assign(new Error(`${entity} not found`), { statusCode: 404 });
  }

  private async requireLesson(id: number): Promise<Lesson> {
    const lesson = await this.lessonRepo.findOne({ where: { id } });
    if (!lesson) this.notFound('Lesson');
    return lesson!;
  }

  private async requireLessonWord(id: number): Promise<LessonWord> {
    const lw = await this.lessonWordRepo.findOne({ where: { id } });
    if (!lw) this.notFound('LessonWord');
    return lw!;
  }

  // ── Lessons ─────────────────────────────────────────────────────────────────

  async listLessons(): Promise<Lesson[]> {
    return this.lessonRepo.find({ order: { id: 'ASC' } });
  }

  async createLesson(title: string, level: string): Promise<Lesson> {
    return this.lessonRepo.save(this.lessonRepo.create({ title, level }));
  }

  async updateLesson(id: number, dto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.requireLesson(id);
    Object.assign(lesson, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.level !== undefined && { level: dto.level }),
    });
    return this.lessonRepo.save(lesson);
  }

  async deleteLesson(id: number): Promise<void> {
    await this.requireLesson(id);
    await this.lessonRepo.delete(id);
  }

  // ── Words ────────────────────────────────────────────────────────────────────

  async removeLessonWord(lessonId: number, lessonWordId: number): Promise<void> {
    const lw = await this.requireLessonWord(lessonWordId);
    if (lw.lessonId !== lessonId) {
      throw Object.assign(
        new Error('LessonWord does not belong to this lesson'),
        { statusCode: 403 },
      );
    }
    await this.lessonWordRepo.delete(lessonWordId);
  }

  async addWordToLesson(lessonId: number, wordId: string): Promise<LessonWord> {
    await this.requireLesson(lessonId);

    const wordExists = await AppDataSource.getRepository(Word).findOne({ where: { id: wordId } });
    if (!wordExists) this.notFound('Word');

    const existing = await this.lessonWordRepo.findOne({ where: { lessonId, wordId } });
    if (existing) {
      throw Object.assign(new Error('Word is already in this lesson'), { statusCode: 409 });
    }

    return this.lessonWordRepo.save(this.lessonWordRepo.create({ lessonId, wordId }));
  }

  // ── Examples ─────────────────────────────────────────────────────────────────

  async removeLessonWordExample(
    lessonId: number,
    lessonWordId: number,
    wordExampleId: number,
  ): Promise<void> {
    const lw = await this.requireLessonWord(lessonWordId);
    if (lw.lessonId !== lessonId) {
      throw Object.assign(
        new Error('LessonWord does not belong to this lesson'),
        { statusCode: 403 },
      );
    }
    const row = await this.lessonWordExRepo.findOne({ where: { lessonWordId, wordExampleId } });
    if (!row) this.notFound('LessonWordExample');
    await this.lessonWordExRepo.delete({ lessonWordId, wordExampleId });
  }

  async addExampleToLessonWord(lessonId: number, lessonWordId: number, wordExampleId: number): Promise<void> {
    const lessonWord = await this.requireLessonWord(lessonWordId);
    if (lessonWord.lessonId !== lessonId) {
      throw Object.assign(
        new Error('LessonWord does not belong to this lesson'),
        { statusCode: 403 },
      );
    }

    const weRow: { word_id: string }[] = await AppDataSource.query(
      'SELECT word_id FROM word_examples WHERE id = $1',
      [wordExampleId],
    );
    if (!weRow.length) this.notFound('WordExample');
    if (weRow[0].word_id !== lessonWord.wordId) {
      throw Object.assign(
        new Error("This example is not associated with the lesson word's word"),
        { statusCode: 422 },
      );
    }

    const existing = await this.lessonWordExRepo.findOne({
      where: { lessonWordId, wordExampleId },
    });
    if (existing) {
      throw Object.assign(
        new Error('Example is already scoped to this lesson word'),
        { statusCode: 409 },
      );
    }

    await this.lessonWordExRepo.save(
      this.lessonWordExRepo.create({ lessonWordId, wordExampleId }),
    );
  }

  // ── Query ─────────────────────────────────────────────────────────────────────

  async getLessonWithWordsAndExamples(lessonId: number): Promise<LessonDetail> {
    const lesson = await this.requireLesson(lessonId);

    const lessonWords = await this.lessonWordRepo.find({
      where: { lessonId },
      relations: ['word'],
    });

    const words: LessonWordDetail[] = await Promise.all(
      lessonWords.map(async (lw) => {
        const examples: Example[] = await AppDataSource.query(
          `
          SELECT e.*
          FROM   lesson_word_examples lwe
          JOIN   word_examples we ON we.id = lwe.word_example_id
          JOIN   examples      e  ON e.id  = we.example_id
          WHERE  lwe.lesson_word_id = $1
          `,
          [lw.id],
        );
        return { lessonWordId: lw.id, word: lw.word, examples };
      }),
    );

    return { id: lesson.id, title: lesson.title, level: lesson.level, words };
  }
}

export const lessonsService = new LessonsService();
