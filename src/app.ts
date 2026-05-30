import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { config } from './config/env.config';
import { registerGoogleStrategy } from './modules/auth/strategies/google.strategy';
import { authRouter } from './modules/auth/controllers/auth.controller';
import { invitationRouter } from './modules/invitations/controllers/invitation.controller';
import { usersRouter } from './modules/users/controllers/users.controller';
import { vocabularyRouter } from './modules/vocabulary/controllers/vocabulary.controller';
import { globalExceptionFilter } from './common/filters/global-exception.filter';

registerGoogleStrategy();

export function createApp(): Application {
  const app = express();

  // CORS must come before Helmet so Access-Control-* headers are set correctly
  // on preflight OPTIONS requests. credentials:true is required for the browser
  // to send/receive HttpOnly cookies across origins.
  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
    }),
  );

  // Helmet adds a strong baseline of security headers.
  // crossOriginEmbedderPolicy is disabled because it can block the Google OAuth
  // redirect flow in some browser configurations.
  app.use(helmet({ crossOriginEmbedderPolicy: false }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(passport.initialize());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: config.nodeEnv });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/invitations', invitationRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/vocabulary', vocabularyRouter);

  // ─── Swagger UI (dev/staging always; prod only if ENABLE_SWAGGER=true) ──────
  // Uses require() so swagger modules are not loaded in production when the flag
  // is off — swagger-jsdoc glob-scans and YAML-parses source files at startup.
  const swaggerEnabled =
    config.nodeEnv !== 'production' || process.env.ENABLE_SWAGGER === 'true';

  if (swaggerEnabled) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const swaggerUi = require('swagger-ui-express') as typeof import('swagger-ui-express');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { buildSwaggerSpec } = require('./config/swagger.config') as typeof import('./config/swagger.config');

    const spec = buildSwaggerSpec();

    // Raw JSON spec — useful for Postman or other tooling imports
    app.get('/api/docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(spec);
    });

    // Helmet's default CSP blocks Swagger UI inline scripts — remove it for this path only
    app.use('/api/docs', (_req, res, next) => {
      res.removeHeader('Content-Security-Policy');
      next();
    });

    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(spec, {
        explorer: true,
        customSiteTitle: 'Abrilingo Teacher API Docs',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          docExpansion: 'list',
          filter: true,
          withCredentials: true,
        },
      }),
    );
  }

  // Must be last — catches all errors passed via next(err) from route handlers
  app.use(globalExceptionFilter);

  return app;
}
