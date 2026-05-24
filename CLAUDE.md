# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Abrilingo teacher backend — REST API for the teacher-facing side of a language learning platform. Roles: `SUPER_ADMIN`, `TEACHER`, `OPERATOR`.

**Stack:** Node.js + Express + TypeScript · PostgreSQL + Redis · TypeORM · Docker

## Commands

```bash
npm run dev          # start dev server (nodemon + ts-node)
npm run build        # compile TypeScript → dist/
npm start            # run compiled output from dist/
npm test             # run full test suite (Jest)
npm run test -- --testPathPattern=<file>  # run a single test file
npm run lint         # ESLint
npm run lint:fix     # auto-fix lint issues

npm run migration:run       # apply pending migrations
npm run migration:generate  # generate migration from entity changes
npm run migration:revert    # roll back last migration
npm run seed:admin          # bootstrap first SUPER_ADMIN (idempotent, reads SUPER_ADMIN_* from .env)

docker-compose up    # start app + postgres + redis containers
```

## Architecture

**Modular Monolith** — NestJS-like module layout, designed for future microservices extraction.

```
src/
  app.ts                  # Express app setup (middleware, routes, error handler)
  main.ts                 # entry point — DB connect, start server
  scripts/
    seed-admin.ts         # one-time super-admin bootstrap (npm run seed:admin)
  modules/
    auth/                 # Google OAuth, JWT issue/refresh/revoke
    users/                # user CRUD, status management
    invitations/          # invite token generation + Resend email
    roles/                # roles + permissions tables
  common/
    guards/               # RBAC guard, JWT auth guard
    decorators/           # @Roles(), @Permissions()
    filters/              # global exception filter
    dtos/                 # shared DTOs
  config/                 # env config, TypeORM data source, Redis client
```

Each module contains: `controllers/`, `services/`, `entities/`, `dtos/`, `repositories/`

**Request flow:** `Guard → Controller → Service → Repository → DB`

## Key Conventions

### Database
- **Never use `synchronize: true`** — all schema changes via TypeORM migrations only.
- Use the **Data Mapper pattern** (`Repository<Entity>`) not Active Record.
- `database.config.ts` calls `dotenv.config()` at the top so that TypeORM CLI commands (`migration:run`, `migration:generate`, `migration:revert`) pick up `.env` automatically — **do not remove this call**.
- The machine may have a native PostgreSQL on port 5432 alongside the Docker-mapped port (`DB_PORT` in `.env`, default `5444`). Always ensure `.env` is present before running any `typeorm` CLI command.

### Super-Admin Bootstrap
- The first `SUPER_ADMIN` must be created via `npm run seed:admin` (invitation-only flow has no other entry point).
- Script lives in `src/scripts/seed-admin.ts`. Required env vars: `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_GOOGLE_ID`. Optional: `SUPER_ADMIN_FIRST_NAME`, `SUPER_ADMIN_LAST_NAME`.
- Script is idempotent — safe to re-run; updates role/status on existing accounts without creating duplicates.

### Authentication
- Google OAuth only (`passport-google-oauth20`) — no local auth.
- Access Token (short-lived) + Refresh Token (long-lived), both in `HttpOnly / Secure / SameSite=Strict` cookies.
- Refresh Token Rotation: every rotation issues a new token and invalidates the old one.
- Redis blacklist for instant revocation (logout, user block).
- JWT payload must include `userId`, `role`, `jti`.

### Authorization
- RBAC via custom guards/decorators.
- Permissions tied to roles **plus** direct user overrides in `user_permissions` table.

### Error Responses
All errors must match: `{ statusCode, message, error, timestamp }` — enforced by the global exception filter.

### Validation
Use `class-validator` + `class-transformer` on every DTO — never validate manually in controllers.

### Invitation Workflow
1. Admin creates invite → token stored in `invitation_tokens` (`email`, `token`, `expires_at`, `is_used`) → email sent via Resend SDK.
2. User clicks link → Google OAuth → token validated → account created as `pending_approval`.
3. Admin activates → Welcome email sent.
