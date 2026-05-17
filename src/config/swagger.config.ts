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
      },
      responses: {
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
