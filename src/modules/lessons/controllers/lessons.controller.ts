import { Router, Request, Response } from 'express';
import { lessonsService } from '../services/lessons.service';
import { jwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { requireRoles } from '../../../common/guards/roles.guard';
import { asyncHandler } from '../../../common/utils/async-handler';
import { validateBody } from '../../../common/middleware/validate-body.middleware';
import { RoleName } from '../../roles/entities/role.entity';
import { CreateLessonDto } from '../dtos/create-lesson.dto';
import { UpdateLessonDto } from '../dtos/update-lesson.dto';
import { AddWordToLessonDto } from '../dtos/add-word-to-lesson.dto';
import { AddExampleToLessonWordDto } from '../dtos/add-example-to-lesson-word.dto';

export const lessonsRouter = Router();

lessonsRouter.use(jwtAuthGuard);

const adminOrOperator = requireRoles(RoleName.SUPER_ADMIN, RoleName.OPERATOR);

// ── Path-param helpers ─────────────────────────────────────────────────────────

function parseIntParam(value: string, name: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 1) {
    throw Object.assign(new Error(`Invalid ${name}: must be a positive integer`), { statusCode: 400 });
  }
  return n;
}

// ============================================================
// LESSONS
// ============================================================

/**
 * @openapi
 * /api/lessons:
 *   get:
 *     tags: [Lessons]
 *     summary: List all lessons
 *     description: |
 *       Returns all lessons ordered by id ascending. No pagination — lessons
 *       are a curated, bounded collection.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Array of lessons
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LessonList'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /api/lessons
lessonsRouter.get(
  '/',
  adminOrOperator,
  asyncHandler(async (_req: Request, res: Response) => {
    const lessons = await lessonsService.listLessons();
    return res.json(lessons);
  }),
);

/**
 * @openapi
 * /api/lessons:
 *   post:
 *     tags: [Lessons]
 *     summary: Create a lesson
 *     description: |
 *       Creates a new lesson with a title and a CEFR level.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateLessonDto'
 *           example:
 *             title: Greetings & Introductions
 *             level: A1
 *     responses:
 *       '201':
 *         description: Lesson created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lesson'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// POST /api/lessons
lessonsRouter.post(
  '/',
  adminOrOperator,
  validateBody(CreateLessonDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { title, level } = req.body as CreateLessonDto;
    const lesson = await lessonsService.createLesson(title, level);
    return res.status(201).json(lesson);
  }),
);

/**
 * @openapi
 * /api/lessons/{lessonId}:
 *   get:
 *     tags: [Lessons]
 *     summary: Get a lesson with words and scoped examples
 *     description: |
 *       Returns the lesson, its words, and — for each word — only the examples
 *       that have been explicitly scoped to that word within this lesson (via
 *       lesson_word_examples). Examples not added to the lesson are excluded even
 *       if they are linked to the word globally.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lesson ID
 *     responses:
 *       '200':
 *         description: Lesson detail with words and scoped examples
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LessonDetail'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// GET /api/lessons/:lessonId
lessonsRouter.get(
  '/:lessonId',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    const lessonId = parseIntParam(req.params.lessonId, 'lessonId');
    const lesson = await lessonsService.getLessonWithWordsAndExamples(lessonId);
    return res.json(lesson);
  }),
);

/**
 * @openapi
 * /api/lessons/{lessonId}:
 *   patch:
 *     tags: [Lessons]
 *     summary: Update a lesson
 *     description: |
 *       Partially updates a lesson's title and/or CEFR level. Only fields
 *       present in the request body are changed.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lesson ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLessonDto'
 *           examples:
 *             changeTitle:
 *               summary: Change title only
 *               value:
 *                 title: Advanced Greetings
 *             changeLevel:
 *               summary: Change level only
 *               value:
 *                 level: A2
 *     responses:
 *       '200':
 *         description: Updated lesson
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Lesson'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// PATCH /api/lessons/:lessonId
lessonsRouter.patch(
  '/:lessonId',
  adminOrOperator,
  validateBody(UpdateLessonDto),
  asyncHandler(async (req: Request, res: Response) => {
    const lessonId = parseIntParam(req.params.lessonId, 'lessonId');
    const lesson = await lessonsService.updateLesson(lessonId, req.body as UpdateLessonDto);
    return res.json(lesson);
  }),
);

/**
 * @openapi
 * /api/lessons/{lessonId}:
 *   delete:
 *     tags: [Lessons]
 *     summary: Delete a lesson
 *     description: |
 *       Permanently deletes a lesson. Associated `lesson_words` and
 *       `lesson_word_examples` rows are removed automatically via DB cascade.
 *       Vocabulary data (`words`, `examples`, `word_examples`) is **not** affected.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lesson ID
 *     responses:
 *       '204':
 *         description: Lesson deleted
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// DELETE /api/lessons/:lessonId
lessonsRouter.delete(
  '/:lessonId',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    const lessonId = parseIntParam(req.params.lessonId, 'lessonId');
    await lessonsService.deleteLesson(lessonId);
    return res.status(204).send();
  }),
);

// ============================================================
// LESSON WORDS
// ============================================================

/**
 * @openapi
 * /api/lessons/{lessonId}/words:
 *   post:
 *     tags: [Lessons]
 *     summary: Add a word to a lesson
 *     description: |
 *       Links an existing vocabulary word to a lesson. Returns the new
 *       lesson_word row (including its `id`, which is needed for scoping
 *       examples via `POST /api/lessons/{lessonId}/words/{lessonWordId}/examples`).
 *       Returns 409 if the word is already in the lesson.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lesson ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddWordToLessonDto'
 *           example:
 *             wordId: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       '201':
 *         description: Word added to lesson
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LessonWord'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// POST /api/lessons/:lessonId/words
lessonsRouter.post(
  '/:lessonId/words',
  adminOrOperator,
  validateBody(AddWordToLessonDto),
  asyncHandler(async (req: Request, res: Response) => {
    const lessonId = parseIntParam(req.params.lessonId, 'lessonId');
    const { wordId } = req.body as AddWordToLessonDto;
    const lessonWord = await lessonsService.addWordToLesson(lessonId, wordId);
    return res.status(201).json(lessonWord);
  }),
);

/**
 * @openapi
 * /api/lessons/{lessonId}/words/{lessonWordId}:
 *   delete:
 *     tags: [Lessons]
 *     summary: Remove a word from a lesson
 *     description: |
 *       Removes a word from a lesson by deleting the `lesson_words` row.
 *       Associated `lesson_word_examples` rows are removed automatically via
 *       DB cascade. The underlying `words`, `examples`, and `word_examples`
 *       rows are **not** affected. Returns 403 if `lessonWordId` does not
 *       belong to `lessonId`.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lesson ID
 *       - in: path
 *         name: lessonWordId
 *         required: true
 *         schema:
 *           type: integer
 *         description: lesson_words.id
 *     responses:
 *       '204':
 *         description: Word removed from lesson
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// DELETE /api/lessons/:lessonId/words/:lessonWordId
lessonsRouter.delete(
  '/:lessonId/words/:lessonWordId',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    const lessonId     = parseIntParam(req.params.lessonId,     'lessonId');
    const lessonWordId = parseIntParam(req.params.lessonWordId,  'lessonWordId');
    await lessonsService.removeLessonWord(lessonId, lessonWordId);
    return res.status(204).send();
  }),
);

// ============================================================
// LESSON WORD EXAMPLES
// ============================================================

/**
 * @openapi
 * /api/lessons/{lessonId}/words/{lessonWordId}/examples:
 *   post:
 *     tags: [Lessons]
 *     summary: Scope an example to a lesson word
 *     description: |
 *       Associates a `word_examples` row (identified by its `id`) with a
 *       lesson_word entry. The referenced `word_examples` row must belong to the
 *       same word that is linked by `lessonWordId` — this prevents adding
 *       examples that are not globally associated with that word.
 *       Returns 404 if the word_example does not exist or does not belong to the
 *       word. Returns 409 if the example is already scoped to this lesson word.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lesson ID (used for URL organisation only; validation is on lessonWordId)
 *       - in: path
 *         name: lessonWordId
 *         required: true
 *         schema:
 *           type: integer
 *         description: lesson_words.id returned by POST /api/lessons/{lessonId}/words
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddExampleToLessonWordDto'
 *           example:
 *             wordExampleId: 42
 *     responses:
 *       '201':
 *         description: Example scoped to lesson word
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: The created lesson_word_examples row.
 *               required: [lessonWordId, wordExampleId]
 *               properties:
 *                 lessonWordId:
 *                   type: integer
 *                   description: ID of the lesson_word entry.
 *                   example: 7
 *                 wordExampleId:
 *                   type: integer
 *                   description: ID of the word_examples row.
 *                   example: 42
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// POST /api/lessons/:lessonId/words/:lessonWordId/examples
lessonsRouter.post(
  '/:lessonId/words/:lessonWordId/examples',
  adminOrOperator,
  validateBody(AddExampleToLessonWordDto),
  asyncHandler(async (req: Request, res: Response) => {
    const lessonId      = parseIntParam(req.params.lessonId,     'lessonId');
    const lessonWordId  = parseIntParam(req.params.lessonWordId,  'lessonWordId');
    const { wordExampleId } = req.body as AddExampleToLessonWordDto;
    await lessonsService.addExampleToLessonWord(lessonId, lessonWordId, wordExampleId);
    return res.status(201).json({ lessonWordId, wordExampleId });
  }),
);

/**
 * @openapi
 * /api/lessons/{lessonId}/words/{lessonWordId}/examples/{wordExampleId}:
 *   delete:
 *     tags: [Lessons]
 *     summary: Remove a scoped example from a lesson word
 *     description: |
 *       Removes a `lesson_word_examples` row, un-scoping the example from
 *       this lesson word. The `word_examples` row and the `examples` row are
 *       **not** deleted — only the lesson-level association is removed.
 *       Returns 403 if `lessonWordId` does not belong to `lessonId`.
 *       Returns 404 if the scoped association does not exist.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Lesson ID
 *       - in: path
 *         name: lessonWordId
 *         required: true
 *         schema:
 *           type: integer
 *         description: lesson_words.id
 *       - in: path
 *         name: wordExampleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: word_examples.id (the SERIAL id added to the join table)
 *     responses:
 *       '204':
 *         description: Example removed from lesson word
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
// DELETE /api/lessons/:lessonId/words/:lessonWordId/examples/:wordExampleId
lessonsRouter.delete(
  '/:lessonId/words/:lessonWordId/examples/:wordExampleId',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    const lessonId      = parseIntParam(req.params.lessonId,      'lessonId');
    const lessonWordId  = parseIntParam(req.params.lessonWordId,   'lessonWordId');
    const wordExampleId = parseIntParam(req.params.wordExampleId,  'wordExampleId');
    await lessonsService.removeLessonWordExample(lessonId, lessonWordId, wordExampleId);
    return res.status(204).send();
  }),
);
