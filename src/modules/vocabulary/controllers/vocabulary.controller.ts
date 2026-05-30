import { Router, Request, Response } from 'express';
import { vocabularyService } from '../services/vocabulary.service';
import { jwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { requireRoles } from '../../../common/guards/roles.guard';
import { asyncHandler } from '../../../common/utils/async-handler';
import { validateBody } from '../../../common/middleware/validate-body.middleware';
import { RoleName } from '../../roles/entities/role.entity';
import { LanguageCode } from '../entities/word.entity';
import { CreateWordDto } from '../dtos/create-word.dto';
import { UpdateWordDto } from '../dtos/update-word.dto';
import { CreateVerbDetailsDto } from '../dtos/create-verb-details.dto';
import { UpdateVerbDetailsDto } from '../dtos/update-verb-details.dto';
import { CreateTranslationDto } from '../dtos/create-translation.dto';
import { UpdateWordTranslationDto } from '../dtos/update-word-translation.dto';
import { CreateExampleDto } from '../dtos/create-example.dto';
import { UpdateExampleDto } from '../dtos/update-example.dto';
import { SetAudioDto } from '../dtos/set-audio.dto';

export const vocabularyRouter = Router();

// All vocabulary routes require authentication
vocabularyRouter.use(jwtAuthGuard);

// Role shortcuts
const adminOrOperator = requireRoles(RoleName.SUPER_ADMIN, RoleName.OPERATOR);

// ── Helper: inline 404 ────────────────────────────────────────────────────────
function notFound(res: Response, entity = 'Resource'): Response {
  return res.status(404).json({
    statusCode: 404,
    message: `${entity} not found`,
    error: 'Not Found',
    timestamp: new Date().toISOString(),
  });
}

// ── Validate language code path param ────────────────────────────────────────
function parseLang(lang: string): LanguageCode | null {
  return Object.values(LanguageCode).includes(lang as LanguageCode) ? (lang as LanguageCode) : null;
}

// ============================================================
// WORDS
// ============================================================

/**
 * @openapi
 * /api/vocabulary/words:
 *   get:
 *     tags: [Vocabulary]
 *     summary: List words
 *     description: |
 *       Returns a paginated list of German words. Supports filtering by CEFR level,
 *       part of speech, umlaut-insensitive partial search, linked example, missing
 *       audio/translations, and date-range filters on updatedAt and audioCreatedAt.
 *       All filter params are optional and compose with AND.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [A1, A2, B1, B2, C1, C2]
 *         description: Filter by CEFR level
 *       - in: query
 *         name: pos
 *         schema:
 *           type: string
 *           enum: [noun, verb, adjective, adverb, preposition, conjunction, article, pronoun, interjection, numeral]
 *         description: Filter by part of speech
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Umlaut-insensitive partial word search (ä/ö/ü/ß handled automatically)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: exampleId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter words linked to this example ID (inner join on word_examples)
 *       - in: query
 *         name: noAudio
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only words with no audio file (audio_file_url IS NULL)
 *       - in: query
 *         name: noTranslationEn
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only words missing an English translation
 *       - in: query
 *         name: noTranslationRu
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only words missing a Russian translation
 *       - in: query
 *         name: noTranslationFa
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only words missing a Persian (Farsi) translation
 *       - in: query
 *         name: noTranslationAr
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only words missing an Arabic translation
 *       - in: query
 *         name: updatedAfter
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return words updated after this timestamp (exclusive)
 *       - in: query
 *         name: updatedBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return words updated before this timestamp (exclusive)
 *       - in: query
 *         name: audioCreatedAfter
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return words whose audio was created after this timestamp (exclusive)
 *       - in: query
 *         name: audioCreatedBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return words whose audio was created before this timestamp (exclusive)
 *     responses:
 *       '200':
 *         description: Paginated word list
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/vocabulary/words
vocabularyRouter.get(
  '/words',
  asyncHandler(async (req: Request, res: Response) => {
    const parseDate = (v: unknown) => (v ? new Date(v as string) : undefined);
    const parseBool = (v: unknown) => (v === 'true' ? true : undefined);

    const result = await vocabularyService.listWords({
      level: req.query.level as string | undefined,
      pos: req.query.pos as string | undefined,
      q: req.query.q as string | undefined,
      exampleId: req.query.exampleId as string | undefined,
      noAudio: parseBool(req.query.noAudio),
      noTranslationEn: parseBool(req.query.noTranslationEn),
      noTranslationRu: parseBool(req.query.noTranslationRu),
      noTranslationFa: parseBool(req.query.noTranslationFa),
      noTranslationAr: parseBool(req.query.noTranslationAr),
      updatedAfter: parseDate(req.query.updatedAfter),
      updatedBefore: parseDate(req.query.updatedBefore),
      audioCreatedAfter: parseDate(req.query.audioCreatedAfter),
      audioCreatedBefore: parseDate(req.query.audioCreatedBefore),
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /api/vocabulary/words:
 *   post:
 *     tags: [Vocabulary]
 *     summary: Create a word
 *     description: |
 *       Creates a new German vocabulary entry. `gender` is required when
 *       `partOfSpeech` is `noun`. Duplicate (word + partOfSpeech) returns 409.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateWordDto'
 *           examples:
 *             noun:
 *               summary: Noun — core fields + inline translations + audio
 *               value:
 *                 word: Tisch
 *                 partOfSpeech: noun
 *                 gender: m
 *                 plural: Tische
 *                 level: A1
 *                 translationFa: میز
 *                 translationEn: table
 *                 translationRu: стол
 *                 translationAr: طاولة
 *                 audioFileUrl: https://cdn.abrilingo.com/audio/de/words/tisch_ai.mp3
 *             verb:
 *               summary: Verb — core fields only (no gender or plural)
 *               value:
 *                 word: sehen
 *                 partOfSpeech: verb
 *                 level: A1
 *                 translationFa: دیدن
 *                 translationEn: to see
 *                 translationRu: видеть
 *                 translationAr: يرى / رأى
 *                 audioFileUrl: https://cdn.abrilingo.com/audio/de/words/sehen_male.mp3
 *             adjective:
 *               summary: Adjective — with translations, no audio
 *               value:
 *                 word: schön
 *                 partOfSpeech: adjective
 *                 level: A2
 *                 translationEn: beautiful
 *                 translationFa: زیبا
 *                 translationRu: красивый
 *                 translationAr: جميل
 *                 audioFileUrl: https://cdn.abrilingo.com/audio/de/words/schön_ai.mp3
 *     responses:
 *       '201':
 *         description: Created word
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Word'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 */
// POST /api/vocabulary/words
vocabularyRouter.post(
  '/words',
  adminOrOperator,
  validateBody(CreateWordDto),
  asyncHandler(async (req: Request, res: Response) => {
    const word = await vocabularyService.createWord(req.body as CreateWordDto);
    return res.status(201).json(word);
  }),
);

/**
 * @openapi
 * /api/vocabulary/words/{id}:
 *   get:
 *     tags: [Vocabulary]
 *     summary: Get a word with all its data
 *     description: |
 *       Returns the word with verb details, translations, examples
 *       (including their translations and audio), and word-level audio.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       '200':
 *         description: Full word object with all relations
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// GET /api/vocabulary/words/:id
vocabularyRouter.get(
  '/words/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const word = await vocabularyService.getWordById(req.params.id);
    if (!word) return notFound(res, 'Word');
    return res.json(word);
  }),
);

/**
 * @openapi
 * /api/vocabulary/words/{id}:
 *   patch:
 *     tags: [Vocabulary]
 *     summary: Update a word
 *     description: |
 *       Partially updates a word. Only the fields present in the request body are
 *       changed — omit anything you do not want to modify.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateWordDto'
 *           examples:
 *             changeLevel:
 *               summary: Change CEFR level only
 *               value:
 *                 level: B1
 *             correctSpelling:
 *               summary: Correct the word spelling
 *               value:
 *                 word: sehen
 *             addPlural:
 *               summary: Add or correct the plural form
 *               value:
 *                 plural: Tische
 *             updateTranslations:
 *               summary: Set or update translations
 *               value:
 *                 translationEn: table
 *                 translationFa: میز
 *                 translationRu: стол
 *                 translationAr: طاولة
 *     responses:
 *       '200':
 *         description: Updated word
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Word'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// PATCH /api/vocabulary/words/:id
vocabularyRouter.patch(
  '/words/:id',
  adminOrOperator,
  validateBody(UpdateWordDto),
  asyncHandler(async (req: Request, res: Response) => {
    const word = await vocabularyService.updateWord(req.params.id, req.body as UpdateWordDto);
    return res.json(word);
  }),
);

/**
 * @openapi
 * /api/vocabulary/words/{id}:
 *   delete:
 *     tags: [Vocabulary]
 *     summary: Delete a word
 *     description: |
 *       Deletes the word and all its children (verb details, translations,
 *       examples, example translations, audio files) via DB cascade.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Deleted
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/vocabulary/words/:id
vocabularyRouter.delete(
  '/words/:id',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    await vocabularyService.deleteWord(req.params.id);
    return res.status(204).send();
  }),
);

// ============================================================
// VERB DETAILS  (sub-resource of word)
// ============================================================

// POST /api/vocabulary/words/:wordId/verb-details
vocabularyRouter.post(
  '/words/:wordId/verb-details',
  adminOrOperator,
  validateBody(CreateVerbDetailsDto),
  asyncHandler(async (req: Request, res: Response) => {
    const details = await vocabularyService.createVerbDetails(req.params.wordId, req.body as CreateVerbDetailsDto);
    return res.status(201).json(details);
  }),
);

// PATCH /api/vocabulary/words/:wordId/verb-details
vocabularyRouter.patch(
  '/words/:wordId/verb-details',
  adminOrOperator,
  validateBody(UpdateVerbDetailsDto),
  asyncHandler(async (req: Request, res: Response) => {
    const details = await vocabularyService.updateVerbDetails(req.params.wordId, req.body as UpdateVerbDetailsDto);
    return res.json(details);
  }),
);

// ============================================================
// WORD TRANSLATIONS  (inline columns on the word row)
// ============================================================

// POST /api/vocabulary/words/:wordId/translations
// Body: { languageCode, translation } — returns 409 if that language is already set.
vocabularyRouter.post(
  '/words/:wordId/translations',
  adminOrOperator,
  validateBody(CreateTranslationDto),
  asyncHandler(async (req: Request, res: Response) => {
    const { languageCode, translation } = req.body as CreateTranslationDto;
    const word = await vocabularyService.setWordTranslation(
      req.params.wordId,
      languageCode,
      translation,
      true, // failIfExists → 409 on duplicate
    );
    return res.status(201).json(word);
  }),
);

// PATCH /api/vocabulary/words/:wordId/translations/:lang
// Body: { translation } — always overwrites.
vocabularyRouter.patch(
  '/words/:wordId/translations/:lang',
  adminOrOperator,
  validateBody(UpdateWordTranslationDto),
  asyncHandler(async (req: Request, res: Response) => {
    const lang = parseLang(req.params.lang);
    if (!lang) return notFound(res, 'Language code');

    const { translation } = req.body as UpdateWordTranslationDto;
    const word = await vocabularyService.setWordTranslation(req.params.wordId, lang, translation);
    return res.json(word);
  }),
);

// DELETE /api/vocabulary/words/:wordId/translations/:lang
// Nulls out the translation column for that language.
vocabularyRouter.delete(
  '/words/:wordId/translations/:lang',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    const lang = parseLang(req.params.lang);
    if (!lang) return notFound(res, 'Language code');

    await vocabularyService.clearWordTranslation(req.params.wordId, lang);
    return res.status(204).send();
  }),
);

// ============================================================
// EXAMPLES  (sub-resource of word)
// ============================================================

// GET /api/vocabulary/examples/:exId — see OpenAPI block near DELETE /examples/:exId
vocabularyRouter.get(
  '/examples/:exId',
  asyncHandler(async (req: Request, res: Response) => {
    const example = await vocabularyService.getExampleById(req.params.exId);
    return res.json(example);
  }),
);

// PATCH /api/vocabulary/examples/:exId
vocabularyRouter.patch(
  '/examples/:exId',
  adminOrOperator,
  validateBody(UpdateExampleDto),
  asyncHandler(async (req: Request, res: Response) => {
    const example = await vocabularyService.updateExample(req.params.exId, req.body as UpdateExampleDto);
    return res.json(example);
  }),
);

/**
 * @openapi
 * /api/vocabulary/words/{wordId}/examples/{exId}:
 *   delete:
 *     tags: [Vocabulary]
 *     summary: Detach example from word
 *     description: |
 *       Removes the word↔example association only. The example row itself is **not**
 *       deleted — it may still be linked to other words. Use
 *       `DELETE /api/vocabulary/examples/{exId}` to permanently delete an example.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: wordId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: exId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Detached (example still exists in the system)
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/vocabulary/words/:wordId/examples/:exId  — detach only
vocabularyRouter.delete(
  '/words/:wordId/examples/:exId',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    await vocabularyService.detachExample(req.params.wordId, req.params.exId);
    return res.status(204).send();
  }),
);

/**
 * @openapi
 * /api/vocabulary/words/{wordId}/examples/{exId}/link:
 *   post:
 *     tags: [Vocabulary]
 *     summary: Link an existing example to a word
 *     description: |
 *       Attaches an already-existing example sentence to an additional word
 *       (many-to-many association). Returns 409 if the example is already linked
 *       to this word. Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: wordId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: exId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Linked successfully
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         $ref: '#/components/responses/Conflict'
 */
// POST /api/vocabulary/words/:wordId/examples/:exId/link
vocabularyRouter.post(
  '/words/:wordId/examples/:exId/link',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    await vocabularyService.linkExample(req.params.wordId, req.params.exId);
    return res.status(204).send();
  }),
);

// ============================================================
// EXAMPLES — standalone (not scoped to a word)
// ============================================================

/**
 * @openapi
 * /api/vocabulary/examples:
 *   post:
 *     tags: [Vocabulary]
 *     summary: Create an example sentence
 *     description: |
 *       Creates a standalone German example sentence (not yet linked to any word).
 *       Use `POST /api/vocabulary/words/{wordId}/examples/{exId}/link` to associate
 *       it with one or more words afterwards. Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateExampleDto'
 *     responses:
 *       '201':
 *         description: Created example
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Example'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 */
// POST /api/vocabulary/examples
vocabularyRouter.post(
  '/examples',
  adminOrOperator,
  validateBody(CreateExampleDto),
  asyncHandler(async (req: Request, res: Response) => {
    const example = await vocabularyService.createExample(req.body as CreateExampleDto);
    return res.status(201).json(example);
  }),
);

/**
 * @openapi
 * /api/vocabulary/examples:
 *   get:
 *     tags: [Vocabulary]
 *     summary: List examples
 *     description: |
 *       Returns a paginated list of all example sentences across all words.
 *       Supports umlaut-insensitive partial search on the sentence text
 *       (ä/ö/ü/ß handled automatically). All filters compose with AND.
 *       Results are ordered newest-first.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Umlaut-insensitive partial sentence search
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: wordId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter examples linked to this word ID
 *       - in: query
 *         name: noAudio
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only examples with no audio (audio_file_url IS NULL)
 *       - in: query
 *         name: noTranslationEn
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only examples missing an English translation
 *       - in: query
 *         name: noTranslationRu
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only examples missing a Russian translation
 *       - in: query
 *         name: noTranslationFa
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only examples missing a Persian translation
 *       - in: query
 *         name: noTranslationAr
 *         schema:
 *           type: string
 *           enum: ['true']
 *         description: Return only examples missing an Arabic translation
 *       - in: query
 *         name: updatedAfter
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return examples updated after this timestamp (exclusive)
 *       - in: query
 *         name: updatedBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return examples updated before this timestamp (exclusive)
 *       - in: query
 *         name: audioCreatedAfter
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return examples whose audio was created after this timestamp (exclusive)
 *       - in: query
 *         name: audioCreatedBefore
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Return examples whose audio was created before this timestamp (exclusive)
 *     responses:
 *       '200':
 *         description: Paginated list of examples
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Example'
 *                 total:
 *                   type: integer
 *                   example: 42
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 20
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
// GET /api/vocabulary/examples
vocabularyRouter.get(
  '/examples',
  asyncHandler(async (req: Request, res: Response) => {
    const parseDate = (v: unknown) => (v ? new Date(v as string) : undefined);
    const parseBool = (v: unknown) => (v === 'true' ? true : undefined);

    const result = await vocabularyService.listAllExamples({
      q: req.query.q as string | undefined,
      wordId: req.query.wordId as string | undefined,
      noAudio: parseBool(req.query.noAudio),
      noTranslationEn: parseBool(req.query.noTranslationEn),
      noTranslationRu: parseBool(req.query.noTranslationRu),
      noTranslationFa: parseBool(req.query.noTranslationFa),
      noTranslationAr: parseBool(req.query.noTranslationAr),
      updatedAfter: parseDate(req.query.updatedAfter),
      updatedBefore: parseDate(req.query.updatedBefore),
      audioCreatedAfter: parseDate(req.query.audioCreatedAfter),
      audioCreatedBefore: parseDate(req.query.audioCreatedBefore),
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.json(result);
  }),
);

/**
 * @openapi
 * /api/vocabulary/examples/{exId}:
 *   get:
 *     tags: [Vocabulary]
 *     summary: Get a single example
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: exId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '200':
 *         description: Example with its translations and audio
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Example'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     tags: [Vocabulary]
 *     summary: Update an example
 *     description: |
 *       Partially updates an example sentence and/or its translations.
 *       Only the fields present in the request body are changed — omit anything
 *       you do not want to modify. Pass `null` for a translation to clear it.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: exId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateExampleDto'
 *           examples:
 *             correctSentence:
 *               summary: Correct the sentence
 *               value:
 *                 sentence: Ich esse gerne Äpfel.
 *             updateTranslations:
 *               summary: Set or update translations
 *               value:
 *                 translationEn: I like eating apples.
 *                 translationFa: من دوست دارم سیب بخورم.
 *             clearTranslation:
 *               summary: Clear a translation
 *               value:
 *                 translationRu: null
 *     responses:
 *       '200':
 *         description: Updated example
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Example'
 *       '400':
 *         $ref: '#/components/responses/BadRequest'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Vocabulary]
 *     summary: Permanently delete an example sentence
 *     description: |
 *       Deletes the example row and all its children (translations, audio files,
 *       and all word associations) via DB cascade. **This is irreversible.**
 *       To only remove the link from one word, use
 *       `DELETE /api/vocabulary/words/{wordId}/examples/{exId}` instead.
 *       Requires SUPER_ADMIN or OPERATOR.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: exId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       '204':
 *         description: Deleted
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
// DELETE /api/vocabulary/examples/:exId  — permanent delete
vocabularyRouter.delete(
  '/examples/:exId',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    await vocabularyService.deleteExamplePermanently(req.params.exId);
    return res.status(204).send();
  }),
);

// ============================================================
// AUDIO  (inline on word / example — one slot each)
// ============================================================

// PUT /api/vocabulary/words/:wordId/audio  — set (or replace) word audio
vocabularyRouter.put(
  '/words/:wordId/audio',
  adminOrOperator,
  validateBody(SetAudioDto),
  asyncHandler(async (req: Request, res: Response) => {
    const word = await vocabularyService.setWordAudio(req.params.wordId, req.body as SetAudioDto);
    return res.json(word);
  }),
);

// DELETE /api/vocabulary/words/:wordId/audio  — clear word audio (sets to null)
vocabularyRouter.delete(
  '/words/:wordId/audio',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    const word = await vocabularyService.clearWordAudio(req.params.wordId);
    return res.json(word);
  }),
);

// PUT /api/vocabulary/words/:wordId/examples/:exId/audio  — set example audio
vocabularyRouter.put(
  '/words/:wordId/examples/:exId/audio',
  adminOrOperator,
  validateBody(SetAudioDto),
  asyncHandler(async (req: Request, res: Response) => {
    const example = await vocabularyService.setExampleAudio(
      req.params.wordId,
      req.params.exId,
      req.body as SetAudioDto,
    );
    return res.json(example);
  }),
);

// DELETE /api/vocabulary/words/:wordId/examples/:exId/audio  — clear example audio
vocabularyRouter.delete(
  '/words/:wordId/examples/:exId/audio',
  adminOrOperator,
  asyncHandler(async (req: Request, res: Response) => {
    const example = await vocabularyService.clearExampleAudio(req.params.wordId, req.params.exId);
    return res.json(example);
  }),
);
