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
        ErrorEnvelope: {
          type: 'object',
          required: ['statusCode', 'message', 'error', 'timestamp'],
          properties: {
            statusCode: { type: 'integer', example: 400 },
            message: { type: 'string', example: 'Validation failed' },
            error: { type: 'string', example: 'Bad Request' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        MessageResponse: {
          type: 'object',
          required: ['message'],
          properties: {
            message: { type: 'string', example: 'Operation successful' },
          },
        },
        Role: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', enum: ['SUPER_ADMIN', 'TEACHER', 'OPERATOR'] },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            status: {
              type: 'string',
              enum: ['pending_approval', 'active', 'suspended'],
            },
            role: { nullable: true, allOf: [{ $ref: '#/components/schemas/Role' }] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Word: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            word: { type: 'string', example: 'Tisch' },
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
            },
            gender: { type: 'string', enum: ['m', 'f', 'n'], nullable: true },
            plural: { type: 'string', nullable: true },
            level: { type: 'string', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
            translationFa: { type: 'string', nullable: true, example: 'میز' },
            translationEn: { type: 'string', nullable: true, example: 'table' },
            translationRu: { type: 'string', nullable: true, example: 'стол' },
            translationAr: { type: 'string', nullable: true, example: 'طاولة' },
            audioFileUrl: { type: 'string', format: 'uri', nullable: true },
            audioCreatedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        InvitationToken: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            expiresAt: { type: 'string', format: 'date-time' },
            isUsed: { type: 'boolean' },
            invitedBy: { nullable: true, allOf: [{ $ref: '#/components/schemas/User' }] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateInvitationRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Normalised to lowercase and trimmed before validation.',
              example: 'teacher@example.com',
            },
          },
        },
        CreateInvitationResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            expiresAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateWordDto: {
          type: 'object',
          required: ['word', 'partOfSpeech', 'level'],
          properties: {
            word: {
              type: 'string',
              example: 'Tisch',
              description: 'The German word as written, including Umlauts and ß.',
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
              example: 'A1',
            },
            translationFa: {
              type: 'string',
              nullable: true,
              example: 'میز',
              description: 'Persian (Farsi) translation — optional at creation.',
            },
            translationEn: {
              type: 'string',
              nullable: true,
              example: 'table',
              description: 'English translation — optional at creation.',
            },
            translationRu: {
              type: 'string',
              nullable: true,
              example: 'стол',
              description: 'Russian translation — optional at creation.',
            },
            translationAr: {
              type: 'string',
              nullable: true,
              example: 'طاولة',
              description: 'Arabic translation — optional at creation.',
            },
            audioFileUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://cdn.abrilingo.com/audio/de/words/tisch_ai.mp3',
              description: 'Audio file URL — audioCreatedAt is set automatically when provided.',
            },
          },
        },
        UpdateWordDto: {
          type: 'object',
          description: 'All fields are optional; supply only the ones you want to change.',
          properties: {
            word: { type: 'string', example: 'Tisch' },
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
            },
            gender: {
              type: 'string',
              enum: ['m', 'f', 'n'],
              nullable: true,
            },
            plural: { type: 'string', nullable: true },
            level: {
              type: 'string',
              enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
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
            audioFileUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://cdn.abrilingo.com/audio/de/examples/tisch_ex1.mp3',
            },
          },
        },
        UpdateExampleDto: {
          type: 'object',
          description: 'All fields are optional; supply only the ones you want to change.',
          properties: {
            sentence: {
              type: 'string',
              description: 'A natural German sentence containing the target word.',
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
        Example: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            sentence: { type: 'string', example: 'Der Tisch ist aus Holz.' },
            translationFa: { type: 'string', nullable: true, example: 'میز از چوب است.' },
            translationEn: { type: 'string', nullable: true, example: 'The table is made of wood.' },
            translationRu: { type: 'string', nullable: true, example: 'Стол сделан из дерева.' },
            translationAr: { type: 'string', nullable: true, example: 'الطاولة مصنوعة من الخشب.' },
            audioFileUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://cdn.abrilingo.com/audio/de/examples/tisch_ex1.mp3',
            },
            audioCreatedAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateWordTranslationDto: {
          type: 'object',
          required: ['languageCode', 'translation'],
          description:
            'Add a translation to a word. Returns 409 if that language is already set — use PATCH to update.',
          properties: {
            languageCode: { type: 'string', enum: ['fa', 'en', 'ru', 'ar'], example: 'en' },
            translation: { type: 'string', example: 'table' },
          },
        },
        UpdateWordTranslationDto: {
          type: 'object',
          required: ['translation'],
          description: 'Replace a word translation (overwrites any existing value).',
          properties: {
            translation: { type: 'string', example: 'table' },
          },
        },
        SetAudioDto: {
          type: 'object',
          required: ['fileUrl'],
          properties: {
            fileUrl: {
              type: 'string',
              format: 'uri',
              example: 'https://cdn.abrilingo.com/audio/de/words/tisch_ai.mp3',
              description: 'Full URL or storage path to the audio file (mp3 / ogg / wav).',
            },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Request body failed DTO validation',
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
          description: 'Request body failed DTO validation',
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
          description: 'Missing, invalid, revoked, or expired access_token cookie',
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
          description: 'Authenticated but insufficient role',
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
          description: 'Resource not found',
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
          description: 'Resource already exists (e.g. email already invited)',
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
          description: 'Rate limit exceeded (20 req / 15 min on invitation endpoints)',
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
      },
    },
    security: [],
  },
  apis: [modulesGlob],
};

export function buildSwaggerSpec(): object {
  return swaggerJsdoc(swaggerOptions);
}
