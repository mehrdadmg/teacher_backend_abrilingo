import path from 'path';
import swaggerJsdoc, { Options } from 'swagger-jsdoc';
import { config } from './env.config';

// ts-node: __dirname = src/config/
// compiled: __dirname = dist/config/
// swagger-jsdoc reads JSDoc from .ts sources — compiled .js has comments stripped.
// src/ is always present alongside dist/ in both local dev and Docker deployments.
const isBuildOutput = __dirname.includes(`dist${path.sep}config`);
const modulesGlob = isBuildOutput
  ? path.resolve(__dirname, '../../src/modules/**/*.ts')
  : path.resolve(__dirname, '../modules/**/*.ts');

const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Abrilingo Teacher API',
      version: '1.0.0',
      description:
        'REST API for the Abrilingo teacher platform.\n\n' +
        '## Authentication\n' +
        'All authenticated endpoints use **HttpOnly cookie-based JWT**. ' +
        'The `access_token` cookie is set automatically after Google OAuth login — ' +
        'no `Authorization` header is required.\n\n' +
        '**Swagger UI:** Complete the OAuth flow in your browser first ' +
        '(`GET /api/auth/google`). The cookie is then sent automatically on ' +
        'Try It Out requests because `withCredentials: true` is configured.\n\n' +
        '**Integration tests / curl:** Pass `Cookie: access_token=<token>` directly.',
      contact: { name: 'Abrilingo Engineering' },
    },
    servers: [
      {
        url: config.appUrl,
        description: config.nodeEnv === 'production' ? 'Production' : 'Development',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Google OAuth2 flow and session management' },
      { name: 'Invitations', description: 'Invitation management (SUPER_ADMIN only)' },
      { name: 'Users', description: 'User management (SUPER_ADMIN / OPERATOR)' },
      { name: 'Health', description: 'Server liveness probe' },
      { name: 'Vocabulary', description: 'German vocabulary management (words, translations, examples, audio)' },
      { name: 'Lessons', description: 'Lesson management — group words and their scoped examples into lessons' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'access_token',
          description:
            'JWT access token delivered as an HttpOnly cookie after Google OAuth login. ' +
            'Send `withCredentials: true` in browser clients or pass the `Cookie` header directly in backend tests.',
        },
      },
      schemas: {
        // ── Shared response envelopes ──────────────────────────────────────────
        ErrorEnvelope: {
          type: 'object',
          description: 'Standard error envelope returned on all 4xx and 5xx responses.',
          required: ['statusCode', 'message', 'error', 'timestamp'],
          properties: {
            statusCode: {
              type: 'integer',
              description: 'HTTP status code mirrored in the body for convenience.',
              example: 400,
            },
            message: {
              type: 'string',
              description: 'Human-readable description of what went wrong.',
              example: 'Validation failed',
            },
            error: {
              type: 'string',
              description: 'Short HTTP status phrase.',
              example: 'Bad Request',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'ISO 8601 timestamp of when the error was generated.',
              example: '2026-05-17T10:00:00.000Z',
            },
          },
        },
        MessageResponse: {
          type: 'object',
          description: 'Simple success acknowledgement returned when no resource data needs to be sent.',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              description: 'Human-readable confirmation of the completed operation.',
              example: 'Operation successful',
            },
          },
        },

        // ── Auth / Users / Roles ───────────────────────────────────────────────
        Role: {
          type: 'object',
          description: 'A system role that defines the access level of a user.',
          required: ['id', 'name'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID primary key of the role.',
              example: 'e3b0c442-98fc-1c14-9afd-2a3d1e7b9c0e',
            },
            name: {
              type: 'string',
              enum: ['SUPER_ADMIN', 'TEACHER', 'OPERATOR'],
              description: 'Role name that controls access permissions across the platform.',
              example: 'TEACHER',
            },
          },
        },
        User: {
          type: 'object',
          description: 'A platform user account including their profile, role, and approval status.',
          required: ['id', 'email', 'firstName', 'lastName', 'status', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID primary key of the user.',
              example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            },
            email: {
              type: 'string',
              format: 'email',
              description: "User's Google account email address.",
              example: 'teacher@example.com',
            },
            firstName: {
              type: 'string',
              description: 'First name from the Google profile.',
              example: 'Jane',
            },
            lastName: {
              type: 'string',
              description: 'Last name from the Google profile.',
              example: 'Doe',
            },
            avatarUrl: {
              type: 'string',
              nullable: true,
              description: "URL to the user's Google profile photo. Null if not provided by Google.",
              example: 'https://lh3.googleusercontent.com/a/ACg8ocJx...',
            },
            status: {
              type: 'string',
              enum: ['pending_approval', 'active', 'suspended'],
              description:
                'Lifecycle state of the account. `pending_approval` — registered but not yet activated by an admin. ' +
                '`active` — fully operational. `suspended` — access revoked; all requests return 401.',
              example: 'active',
            },
            role: {
              nullable: true,
              description: 'Assigned role. Null if no role has been assigned yet.',
              allOf: [{ $ref: '#/components/schemas/Role' }],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the user record was first created (ISO 8601).',
              example: '2026-01-15T08:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp of the most recent update to the user record (ISO 8601).',
              example: '2026-03-10T12:30:00.000Z',
            },
          },
        },

        // ── Vocabulary: Words ──────────────────────────────────────────────────
        Word: {
          type: 'object',
          description:
            'A German vocabulary entry with part-of-speech classification, CEFR level, ' +
            'optional inline translations in four languages, and optional audio.',
          required: ['id', 'word', 'partOfSpeech', 'level', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID primary key of the vocabulary entry.',
              example: 'b1a2c3d4-e5f6-7890-abcd-ef1234567890',
            },
            word: {
              type: 'string',
              description: 'The German word as written, including Umlauts and ß.',
              example: 'Tisch',
            },
            partOfSpeech: {
              type: 'string',
              enum: [
                'noun',
                'verb',
                'adjective',
                'adverb',
                'preposition',
                'conjunction',
                'article',
                'pronoun',
                'interjection',
                'numeral',
              ],
              description: 'Grammatical category of the word.',
              example: 'noun',
            },
            gender: {
              type: 'string',
              enum: ['m', 'f', 'n'],
              nullable: true,
              description: 'Grammatical gender — applies to nouns only; null for all other parts of speech.',
              example: 'm',
            },
            plural: {
              type: 'string',
              nullable: true,
              description: 'Plural form of the noun (e.g. "Tische"). Null for non-nouns or when unknown.',
              example: 'Tische',
            },
            level: {
              type: 'string',
              enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
              description: 'CEFR proficiency level at which this word is typically introduced.',
              example: 'A1',
            },
            translationFa: {
              type: 'string',
              nullable: true,
              description: 'Persian (Farsi) translation. Null if not yet set.',
              example: 'میز',
            },
            translationEn: {
              type: 'string',
              nullable: true,
              description: 'English translation. Null if not yet set.',
              example: 'table',
            },
            translationRu: {
              type: 'string',
              nullable: true,
              description: 'Russian translation. Null if not yet set.',
              example: 'стол',
            },
            translationAr: {
              type: 'string',
              nullable: true,
              description: 'Arabic translation. Null if not yet set.',
              example: 'طاولة',
            },
            audioFileUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'URL to the word pronunciation audio file. Null if no audio has been set.',
              example: 'https://cdn.abrilingo.com/audio/de/words/tisch_ai.mp3',
            },
            audioCreatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Timestamp when the audio file was first attached. Null if no audio.',
              example: '2026-02-01T09:00:00.000Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when this vocabulary entry was created (ISO 8601).',
              example: '2026-01-15T08:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp of the most recent update to this entry (ISO 8601).',
              example: '2026-03-10T12:30:00.000Z',
            },
          },
        },

        // ── Vocabulary: Examples ───────────────────────────────────────────────
        WordExampleEntry: {
          type: 'object',
          description:
            'An example sentence linked to a word, annotated with the `word_examples.id` ' +
            'SERIAL key needed to scope the example into a lesson via ' +
            '`POST /api/lessons/{lessonId}/words/{lessonWordId}/examples`.',
          required: ['wordExampleId', 'id', 'sentence', 'createdAt', 'updatedAt'],
          properties: {
            wordExampleId: {
              type: 'integer',
              description: 'Auto-assigned id of the word_examples join-table row. Pass this as `wordExampleId` when adding to a lesson word.',
              example: 42,
            },
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID primary key of the example sentence.',
              example: 'd4e5f6a7-b8c9-0123-def4-567890abcdef',
            },
            sentence: {
              type: 'string',
              description: 'The German example sentence.',
              example: 'Der Tisch ist aus Holz.',
            },
            translationFa: {
              type: 'string',
              nullable: true,
              description: 'Persian (Farsi) translation. Null if not set.',
              example: 'میز از چوب است.',
            },
            translationEn: {
              type: 'string',
              nullable: true,
              description: 'English translation. Null if not set.',
              example: 'The table is made of wood.',
            },
            translationRu: {
              type: 'string',
              nullable: true,
              description: 'Russian translation. Null if not set.',
              example: 'Стол сделан из дерева.',
            },
            translationAr: {
              type: 'string',
              nullable: true,
              description: 'Arabic translation. Null if not set.',
              example: 'الطاولة مصنوعة من الخشب.',
            },
            audioFileUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'URL to the example audio file. Null if not set.',
              example: 'https://cdn.abrilingo.com/audio/de/examples/tisch_ex1.mp3',
            },
            audioCreatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'When the example audio was attached. Null if no audio.',
              example: '2026-02-05T10:00:00.000Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'When this example was created.',
              example: '2026-01-15T08:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'When this example was last updated.',
              example: '2026-03-10T12:30:00.000Z',
            },
          },
        },
        Example: {
          type: 'object',
          description: 'A German example sentence associated with one or more vocabulary words.',
          required: ['id', 'sentence', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID primary key of the example sentence.',
              example: 'd4e5f6a7-b8c9-0123-def4-567890abcdef',
            },
            sentence: {
              type: 'string',
              description: 'The German example sentence containing the target vocabulary word.',
              example: 'Der Tisch ist aus Holz.',
            },
            translationFa: {
              type: 'string',
              nullable: true,
              description: 'Persian (Farsi) translation. Null if not set.',
              example: 'میز از چوب است.',
            },
            translationEn: {
              type: 'string',
              nullable: true,
              description: 'English translation. Null if not set.',
              example: 'The table is made of wood.',
            },
            translationRu: {
              type: 'string',
              nullable: true,
              description: 'Russian translation. Null if not set.',
              example: 'Стол сделан из дерева.',
            },
            translationAr: {
              type: 'string',
              nullable: true,
              description: 'Arabic translation. Null if not set.',
              example: 'الطاولة مصنوعة من الخشب.',
            },
            audioFileUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'URL to the example sentence audio file. Null if not set.',
              example: 'https://cdn.abrilingo.com/audio/de/examples/tisch_ex1.mp3',
            },
            audioCreatedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Timestamp when the example audio was first attached. Null if no audio.',
              example: '2026-02-05T10:00:00.000Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when this example was created (ISO 8601).',
              example: '2026-01-15T08:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp of the most recent update to this example (ISO 8601).',
              example: '2026-03-10T12:30:00.000Z',
            },
          },
        },

        // ── Vocabulary: Verb Details ───────────────────────────────────────────
        VerbDetails: {
          type: 'object',
          description: 'Conjugation data for a German verb word entry.',
          required: ['id', 'wordId', 'isRegular', 'createdAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID primary key of the verb details record.',
              example: 'e5f6a7b8-c9d0-1234-ef56-7890abcdef12',
            },
            wordId: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the parent Word entry this record belongs to.',
              example: 'b1a2c3d4-e5f6-7890-abcd-ef1234567890',
            },
            isRegular: {
              type: 'boolean',
              description: 'Whether the verb follows standard German regular conjugation patterns.',
              example: false,
            },
            presentThirdPerson: {
              type: 'string',
              nullable: true,
              description: 'Präsens 3. Person Singular form (e.g. "sieht" for "sehen").',
              example: 'sieht',
            },
            praeteritumThirdPerson: {
              type: 'string',
              nullable: true,
              description: 'Präteritum 3. Person Singular form (e.g. "sah" for "sehen").',
              example: 'sah',
            },
            perfektAuxiliary: {
              type: 'string',
              enum: ['haben', 'sein'],
              nullable: true,
              description: 'Perfekt auxiliary verb — either "haben" or "sein".',
              example: 'haben',
            },
            perfectParticiple: {
              type: 'string',
              nullable: true,
              description: 'Partizip II form used in the Perfekt tense (e.g. "gesehen").',
              example: 'gesehen',
            },
            imperativeDu: {
              type: 'string',
              nullable: true,
              description: 'Imperativ du-form (e.g. "sieh!").',
              example: 'sieh',
            },
            imperativeIhr: {
              type: 'string',
              nullable: true,
              description: 'Imperativ ihr-form (e.g. "seht!").',
              example: 'seht',
            },
            imperativeSie: {
              type: 'string',
              nullable: true,
              description: 'Imperativ Sie-form (polite, e.g. "sehen Sie!").',
              example: 'sehen Sie',
            },
            reflexivePronoun: {
              type: 'string',
              nullable: true,
              description: 'Reflexivpronomen (e.g. "sich"). Null when the verb is not reflexive.',
              example: null,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when this verb details record was created (ISO 8601).',
              example: '2026-01-15T08:00:00.000Z',
            },
          },
        },

        // ── Vocabulary: Composed / Paginated ──────────────────────────────────
        ExampleInWord: {
          description:
            'An example sentence as returned within a word context. Identical to Example ' +
            'but includes `wordExampleId` — the integer id of the word_examples join row. ' +
            'Use this value as `wordExampleId` when scoping the example to a lesson word via ' +
            '`POST /api/lessons/{lessonId}/words/{lessonWordId}/examples`.',
          allOf: [
            { $ref: '#/components/schemas/Example' },
            {
              type: 'object',
              required: ['wordExampleId'],
              properties: {
                wordExampleId: {
                  type: 'integer',
                  description:
                    'Integer primary key of the word_examples join-table row. ' +
                    'Required by the lessons API to scope this example to a lesson word.',
                  example: 3,
                },
              },
            },
          ],
        },
        WordWithRelations: {
          description: 'Full word object including its verb conjugation details and linked example sentences.',
          allOf: [
            { $ref: '#/components/schemas/Word' },
            {
              type: 'object',
              properties: {
                verbDetails: {
                  type: 'array',
                  description: 'Conjugation records for the word. Empty array for non-verbs.',
                  items: { $ref: '#/components/schemas/VerbDetails' },
                },
                examples: {
                  type: 'array',
                  description:
                    'Example sentences linked to this word. Each item includes `wordExampleId` ' +
                    '(the word_examples join-table id) needed for the lessons scoping API.',
                  items: { $ref: '#/components/schemas/ExampleInWord' },
                },
              },
            },
          ],
        },
        PaginatedWords: {
          type: 'object',
          description: 'A paginated list of German vocabulary words.',
          required: ['data', 'total', 'page', 'limit'],
          properties: {
            data: {
              type: 'array',
              description: 'The current page of word entries.',
              items: { $ref: '#/components/schemas/Word' },
            },
            total: {
              type: 'integer',
              description: 'Total number of words matching the applied filters.',
              example: 150,
            },
            page: {
              type: 'integer',
              description: 'Current page number (1-indexed).',
              example: 1,
            },
            limit: {
              type: 'integer',
              description: 'Maximum number of results per page.',
              example: 20,
            },
          },
        },
        PaginatedExamples: {
          type: 'object',
          description: 'A paginated list of example sentences.',
          required: ['data', 'total', 'page', 'limit'],
          properties: {
            data: {
              type: 'array',
              description: 'The current page of example sentences.',
              items: { $ref: '#/components/schemas/Example' },
            },
            total: {
              type: 'integer',
              description: 'Total number of examples matching the applied filters.',
              example: 42,
            },
            page: {
              type: 'integer',
              description: 'Current page number (1-indexed).',
              example: 1,
            },
            limit: {
              type: 'integer',
              description: 'Maximum number of results per page.',
              example: 20,
            },
          },
        },

        // ── Invitations ────────────────────────────────────────────────────────
        InvitationToken: {
          type: 'object',
          description: 'An invitation token issued by a SUPER_ADMIN to allow a new user to register.',
          required: ['id', 'email', 'expiresAt', 'isUsed', 'createdAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID primary key of the invitation.',
              example: 'c9d8e7f6-a5b4-3c2d-1e0f-9876543210ab',
            },
            email: {
              type: 'string',
              format: 'email',
              description: "The invited person's email address (normalised to lowercase).",
              example: 'newteacher@example.com',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the invitation token expires (7 days after creation).',
              example: '2026-01-22T08:00:00.000Z',
            },
            isUsed: {
              type: 'boolean',
              description: 'True once the invitee has completed registration via Google OAuth.',
              example: false,
            },
            invitedBy: {
              nullable: true,
              description: 'The SUPER_ADMIN who sent this invitation. Null if that user was deleted.',
              allOf: [{ $ref: '#/components/schemas/User' }],
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the invitation was created (ISO 8601).',
              example: '2026-01-15T08:00:00.000Z',
            },
          },
        },
        CreateInvitationRequest: {
          type: 'object',
          description: 'Request body for creating and sending a new invitation.',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address to invite. Normalised to lowercase and trimmed before validation.',
              example: 'teacher@example.com',
            },
          },
        },
        CreateInvitationResponse: {
          type: 'object',
          description: 'Minimal invitation record returned immediately after creation.',
          required: ['id', 'email', 'expiresAt', 'createdAt'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the newly created invitation.',
              example: 'c9d8e7f6-a5b4-3c2d-1e0f-9876543210ab',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'The invited email address.',
              example: 'newteacher@example.com',
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Expiry timestamp — 7 days after creation.',
              example: '2026-01-22T08:00:00.000Z',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Timestamp when the invitation was created.',
              example: '2026-01-15T08:00:00.000Z',
            },
          },
        },

        // ── DTOs (request bodies) ──────────────────────────────────────────────
        CreateWordDto: {
          type: 'object',
          description: 'Request body for creating a new German vocabulary entry.',
          required: ['word', 'partOfSpeech', 'level'],
          properties: {
            word: {
              type: 'string',
              description: 'The German word as written, including Umlauts and ß.',
              example: 'Tisch',
            },
            partOfSpeech: {
              type: 'string',
              enum: [
                'noun',
                'verb',
                'adjective',
                'adverb',
                'preposition',
                'conjunction',
                'article',
                'pronoun',
                'interjection',
                'numeral',
              ],
              description: 'Grammatical category of the word.',
              example: 'noun',
            },
            gender: {
              type: 'string',
              enum: ['m', 'f', 'n'],
              nullable: true,
              description: 'Required when partOfSpeech is "noun"; omit for all other parts of speech.',
              example: 'm',
            },
            plural: {
              type: 'string',
              nullable: true,
              description: 'Plural form — nouns only (e.g. "Tische").',
              example: 'Tische',
            },
            level: {
              type: 'string',
              enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
              description: 'CEFR proficiency level at which this word is typically introduced.',
              example: 'A1',
            },
            translationFa: {
              type: 'string',
              nullable: true,
              description: 'Persian (Farsi) translation — optional at creation.',
              example: 'میز',
            },
            translationEn: {
              type: 'string',
              nullable: true,
              description: 'English translation — optional at creation.',
              example: 'table',
            },
            translationRu: {
              type: 'string',
              nullable: true,
              description: 'Russian translation — optional at creation.',
              example: 'стол',
            },
            translationAr: {
              type: 'string',
              nullable: true,
              description: 'Arabic translation — optional at creation.',
              example: 'طاولة',
            },
            audioFileUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Audio file URL — audioCreatedAt is set automatically when provided.',
              example: 'https://cdn.abrilingo.com/audio/de/words/tisch_ai.mp3',
            },
          },
        },
        UpdateWordDto: {
          type: 'object',
          description: 'All fields are optional; supply only the ones you want to change.',
          properties: {
            word: {
              type: 'string',
              description: 'Corrected spelling of the German word.',
              example: 'Tisch',
            },
            partOfSpeech: {
              type: 'string',
              enum: [
                'noun',
                'verb',
                'adjective',
                'adverb',
                'preposition',
                'conjunction',
                'article',
                'pronoun',
                'interjection',
                'numeral',
              ],
              description: 'Updated grammatical category.',
            },
            gender: {
              type: 'string',
              enum: ['m', 'f', 'n'],
              nullable: true,
              description: 'Updated grammatical gender (nouns only). Pass null to clear.',
            },
            plural: {
              type: 'string',
              nullable: true,
              description: 'Updated plural form. Pass null to clear.',
            },
            level: {
              type: 'string',
              enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
              description: 'Updated CEFR level.',
            },
            translationFa: {
              type: 'string',
              nullable: true,
              description: 'Update Persian translation (pass null to clear).',
            },
            translationEn: {
              type: 'string',
              nullable: true,
              description: 'Update English translation (pass null to clear).',
            },
            translationRu: {
              type: 'string',
              nullable: true,
              description: 'Update Russian translation (pass null to clear).',
            },
            translationAr: {
              type: 'string',
              nullable: true,
              description: 'Update Arabic translation (pass null to clear).',
            },
            audioFileUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              description: 'Update audio URL (pass null to clear; audioCreatedAt is managed automatically).',
            },
          },
        },
        CreateExampleDto: {
          type: 'object',
          description: 'Request body for creating a standalone German example sentence.',
          required: ['sentence'],
          properties: {
            sentence: {
              type: 'string',
              description: 'A natural German sentence containing the target word.',
              example: 'Der Tisch ist aus Holz.',
            },
            translationFa: {
              type: 'string',
              nullable: true,
              description: 'Persian (Farsi) translation.',
              example: 'میز از چوب است.',
            },
            translationEn: {
              type: 'string',
              nullable: true,
              description: 'English translation.',
              example: 'The table is made of wood.',
            },
            translationRu: {
              type: 'string',
              nullable: true,
              description: 'Russian translation.',
              example: 'Стол сделан из дерева.',
            },
            translationAr: {
              type: 'string',
              nullable: true,
              description: 'Arabic translation.',
              example: 'الطاولة مصنوعة من الخشب.',
            },
          },
        },
        UpdateExampleDto: {
          type: 'object',
          description: 'All fields are optional; supply only the ones you want to change. Pass null for a translation to clear it.',
          properties: {
            sentence: {
              type: 'string',
              description: 'Updated German sentence text.',
              example: 'Der Tisch ist aus Holz.',
            },
            translationFa: {
              type: 'string',
              nullable: true,
              description: 'Persian (Farsi) translation (pass null to clear).',
            },
            translationEn: {
              type: 'string',
              nullable: true,
              description: 'English translation (pass null to clear).',
            },
            translationRu: {
              type: 'string',
              nullable: true,
              description: 'Russian translation (pass null to clear).',
            },
            translationAr: {
              type: 'string',
              nullable: true,
              description: 'Arabic translation (pass null to clear).',
            },
          },
        },
        CreateVerbDetailsDto: {
          type: 'object',
          description: 'Request body for adding conjugation details to a verb word.',
          required: ['isRegular'],
          properties: {
            isRegular: {
              type: 'boolean',
              description: 'Whether the verb follows regular German conjugation patterns.',
              example: false,
            },
            presentThirdPerson: {
              type: 'string',
              description: 'Präsens 3. Person Singular — e.g. "sieht".',
              example: 'sieht',
            },
            praeteritumThirdPerson: {
              type: 'string',
              description: 'Präteritum 3. Person Singular — e.g. "sah".',
              example: 'sah',
            },
            perfektAuxiliary: {
              type: 'string',
              enum: ['haben', 'sein'],
              description: 'Perfekt auxiliary verb.',
              example: 'haben',
            },
            perfectParticiple: {
              type: 'string',
              description: 'Partizip II — e.g. "gesehen".',
              example: 'gesehen',
            },
            imperativeDu: {
              type: 'string',
              description: 'Imperativ du-form.',
              example: 'sieh',
            },
            imperativeIhr: {
              type: 'string',
              description: 'Imperativ ihr-form.',
              example: 'seht',
            },
            imperativeSie: {
              type: 'string',
              description: 'Imperativ Sie-form (polite).',
              example: 'sehen Sie',
            },
            reflexivePronoun: {
              type: 'string',
              description: 'Reflexivpronomen — e.g. "sich". Omit when not reflexive.',
              example: 'sich',
            },
          },
        },
        UpdateVerbDetailsDto: {
          type: 'object',
          description: 'All fields are optional; supply only the ones you want to change. Pass null to clear a field.',
          properties: {
            isRegular: {
              type: 'boolean',
              description: 'Updated regularity flag.',
            },
            presentThirdPerson: {
              type: 'string',
              nullable: true,
              description: 'Updated Präsens 3. Person Singular form (null to clear).',
            },
            praeteritumThirdPerson: {
              type: 'string',
              nullable: true,
              description: 'Updated Präteritum 3. Person Singular form (null to clear).',
            },
            perfektAuxiliary: {
              type: 'string',
              enum: ['haben', 'sein'],
              nullable: true,
              description: 'Updated Perfekt auxiliary verb (null to clear).',
            },
            perfectParticiple: {
              type: 'string',
              nullable: true,
              description: 'Updated Partizip II form (null to clear).',
            },
            imperativeDu: {
              type: 'string',
              nullable: true,
              description: 'Updated Imperativ du-form (null to clear).',
            },
            imperativeIhr: {
              type: 'string',
              nullable: true,
              description: 'Updated Imperativ ihr-form (null to clear).',
            },
            imperativeSie: {
              type: 'string',
              nullable: true,
              description: 'Updated Imperativ Sie-form (null to clear).',
            },
            reflexivePronoun: {
              type: 'string',
              nullable: true,
              description: 'Updated Reflexivpronomen (null to clear).',
            },
          },
        },
        CreateWordTranslationDto: {
          type: 'object',
          required: ['languageCode', 'translation'],
          description:
            'Add a translation to a word. Returns 409 if that language is already set — use PATCH to update.',
          properties: {
            languageCode: {
              type: 'string',
              enum: ['fa', 'en', 'ru', 'ar'],
              description: 'Language code identifying which translation column to set.',
              example: 'en',
            },
            translation: {
              type: 'string',
              description: 'The translated text in the specified language.',
              example: 'table',
            },
          },
        },
        UpdateWordTranslationDto: {
          type: 'object',
          required: ['translation'],
          description: 'Replace a word translation (overwrites any existing value).',
          properties: {
            translation: {
              type: 'string',
              description: 'The new translated text (always overwrites the existing value).',
              example: 'table',
            },
          },
        },
        SetAudioDto: {
          type: 'object',
          description: 'Request body for setting an audio file URL on a word or example.',
          required: ['fileUrl'],
          properties: {
            fileUrl: {
              type: 'string',
              format: 'uri',
              description: 'Full URL or storage path to the audio file (mp3 / ogg / wav).',
              example: 'https://cdn.abrilingo.com/audio/de/words/tisch_ai.mp3',
            },
          },
        },

        // ── Lessons ────────────────────────────────────────────────────────────
        LessonList: {
          type: 'array',
          description: 'All lessons ordered by id ascending.',
          items: {
            $ref: '#/components/schemas/Lesson',
          },
        },
        UpdateLessonDto: {
          type: 'object',
          description: 'Request body for partially updating a lesson. At least one field should be provided.',
          properties: {
            title: {
              type: 'string',
              description: 'New lesson title.',
              example: 'Advanced Greetings',
            },
            level: {
              type: 'string',
              enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
              description: 'New CEFR level.',
              example: 'A2',
            },
          },
        },
        CreateLessonDto: {
          type: 'object',
          description: 'Request body for creating a new lesson.',
          required: ['title', 'level'],
          properties: {
            title: {
              type: 'string',
              description: 'Human-readable lesson title.',
              example: 'Greetings & Introductions',
            },
            level: {
              type: 'string',
              enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
              description: 'CEFR level this lesson targets.',
              example: 'A1',
            },
          },
        },
        AddWordToLessonDto: {
          type: 'object',
          description: 'Request body for adding a vocabulary word to a lesson.',
          required: ['wordId'],
          properties: {
            wordId: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the vocabulary word to add.',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        },
        AddExampleToLessonWordDto: {
          type: 'object',
          description: 'Request body for scoping a word_examples row to a lesson word.',
          required: ['wordExampleId'],
          properties: {
            wordExampleId: {
              type: 'integer',
              minimum: 1,
              description:
                'The integer `wordExampleId` exposed on each example item returned by ' +
                '`GET /api/vocabulary/words/{id}` (see `ExampleInWord` schema). ' +
                'It identifies which word_examples join-table row to scope into this lesson.',
              example: 3,
            },
          },
        },
        Lesson: {
          type: 'object',
          description: 'A lesson grouping vocabulary words at a given CEFR level.',
          required: ['id', 'title', 'level'],
          properties: {
            id: {
              type: 'integer',
              description: 'Auto-assigned lesson ID.',
              example: 1,
            },
            title: {
              type: 'string',
              description: 'Human-readable lesson title.',
              example: 'Greetings & Introductions',
            },
            level: {
              type: 'string',
              enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
              description: 'CEFR level this lesson targets.',
              example: 'A1',
            },
          },
        },
        LessonWord: {
          type: 'object',
          description: 'A lesson_words row linking a lesson to a vocabulary word.',
          required: ['id', 'lessonId', 'wordId'],
          properties: {
            id: {
              type: 'integer',
              description: 'Auto-assigned lesson_word ID. Required when scoping examples.',
              example: 7,
            },
            lessonId: {
              type: 'integer',
              description: 'ID of the parent lesson.',
              example: 1,
            },
            wordId: {
              type: 'string',
              format: 'uuid',
              description: 'UUID of the linked vocabulary word.',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
          },
        },
        LessonDetail: {
          type: 'object',
          description: 'Full lesson payload including words and their lesson-scoped examples.',
          required: ['id', 'title', 'level', 'words'],
          properties: {
            id: {
              type: 'integer',
              description: 'Lesson ID.',
              example: 1,
            },
            title: {
              type: 'string',
              description: 'Lesson title.',
              example: 'Greetings & Introductions',
            },
            level: {
              type: 'string',
              enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
              description: 'CEFR level.',
              example: 'A1',
            },
            words: {
              type: 'array',
              description: 'Words in this lesson, each with only the examples scoped to it within this lesson.',
              items: {
                type: 'object',
                required: ['lessonWordId', 'word', 'examples'],
                properties: {
                  lessonWordId: {
                    type: 'integer',
                    description: 'lesson_words.id for this entry.',
                    example: 7,
                  },
                  word: {
                    $ref: '#/components/schemas/Word',
                  },
                  examples: {
                    type: 'array',
                    description: 'Examples scoped to this word within the lesson (subset of the word\'s global examples).',
                    items: {
                      $ref: '#/components/schemas/Example',
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Request body failed DTO validation.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: {
                statusCode: 400,
                message: 'word should not be empty',
                error: 'Bad Request',
                timestamp: '2026-05-17T10:00:00.000Z',
              },
            },
          },
        },
        ValidationError: {
          description: 'Request body failed DTO validation.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: {
                statusCode: 400,
                message: 'email must be a valid email address',
                error: 'Bad Request',
                timestamp: '2026-05-17T10:00:00.000Z',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Missing, invalid, revoked, or expired access_token cookie.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: {
                statusCode: 401,
                message: 'Authentication required',
                error: 'Unauthorized',
                timestamp: '2026-05-17T10:00:00.000Z',
              },
            },
          },
        },
        Forbidden: {
          description: 'Authenticated but caller lacks the required role.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: {
                statusCode: 403,
                message: 'Insufficient permissions',
                error: 'Forbidden',
                timestamp: '2026-05-17T10:00:00.000Z',
              },
            },
          },
        },
        NotFound: {
          description: 'The requested resource does not exist.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: {
                statusCode: 404,
                message: 'User not found',
                error: 'Not Found',
                timestamp: '2026-05-17T10:00:00.000Z',
              },
            },
          },
        },
        Conflict: {
          description: 'Resource already exists or is in a conflicting state (e.g. email already invited).',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: {
                statusCode: 409,
                message: 'An invitation for this email already exists',
                error: 'Conflict',
                timestamp: '2026-05-17T10:00:00.000Z',
              },
            },
          },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded — 20 requests per 15 minutes on invitation endpoints.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: {
                statusCode: 429,
                message: 'Too many invitation requests, please try again later',
                error: 'Too Many Requests',
                timestamp: '2026-05-17T10:00:00.000Z',
              },
            },
          },
        },
        InternalServerError: {
          description: 'An unexpected server-side error occurred.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: {
                statusCode: 500,
                message: 'Internal server error',
                error: 'Internal Server Error',
                timestamp: '2026-05-17T10:00:00.000Z',
              },
            },
          },
        },
      },
    },
    security: [],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Liveness probe',
          description: 'Returns server status and the current environment. No authentication required.',
          responses: {
            '200': {
              description: 'Server is up.',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['status', 'env'],
                    properties: {
                      status: {
                        type: 'string',
                        description: 'Always "ok" when the server is healthy.',
                        example: 'ok',
                      },
                      env: {
                        type: 'string',
                        description: 'Current NODE_ENV value.',
                        example: 'development',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [modulesGlob],
};

export function buildSwaggerSpec(): object {
  return swaggerJsdoc(swaggerOptions);
}
