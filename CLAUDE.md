# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Abrilingo teacher backend — REST API for the teacher-facing side of a language learning platform. Roles: `SUPER_ADMIN`, `TEACHER`, `OPERATOR`.

**Stack:** Node.js + Express + TypeScript · PostgreSQL + Redis · TypeORM · Docker

**Important** Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

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
npm run seed:vocabulary     # load German vocabulary sample data (idempotent)

docker-compose up    # start app + postgres + redis containers
```

## Architecture

**Modular Monolith** — NestJS-like module layout, designed for future microservices extraction.

```
src/
  app.ts                  # Express app setup (middleware, routes, error handler)
  main.ts                 # entry point — DB connect, start server
  migrations/             # TypeORM migration files (chronological, never edited after run)
  scripts/
    seed-admin.ts         # one-time super-admin bootstrap (npm run seed:admin)
    seed-vocabulary.ts    # German vocabulary sample data (npm run seed:vocabulary)
  modules/
    auth/                 # Google OAuth, JWT issue/refresh/revoke
    users/                # user CRUD, status management
    invitations/          # invite token generation + Resend email
    roles/                # roles + permissions tables
    vocabulary/           # German vocabulary CRUD — words (with inline translations + audio),
                          # verb details, examples (M2M with words, inline translations + audio)
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

### Vocabulary Module

The vocabulary module manages German word entries across **three main tables** (`words`, `examples`, `verb_details`) plus one join table (`word_examples`). Translations and audio are stored as inline columns — there are no separate translation or audio tables.

**Schema summary:**
- `words` — id, word, part_of_speech, gender, plural, level, created_at, updated_at, translation_fa/en/ru/ar (nullable TEXT), audio_file_url (nullable TEXT), audio_created_at (nullable TIMESTAMPTZ)
- `examples` — id, sentence, translation_fa/en/ru/ar (nullable TEXT), audio_file_url, audio_created_at, created_at, updated_at
- `verb_details` — conjugation data, FK → words
- `word_examples` — join table (word_id, example_id)

**Many-to-many: Word ↔ Example**
- Examples are linked to words via the `word_examples` join table — one example can belong to multiple words.
- `Word` is the owning side: `@ManyToMany ... @JoinTable({ name: 'word_examples' })`.
- `Example` has only the inverse side: `@ManyToMany(() => Word, w => w.examples) words: Word[]`.
- The `examples` table has **no** `word_id` column. Never query examples with `{ where: { wordId } }` — use `createQueryBuilder` with `innerJoin('example.words', 'word', 'word.id = :wordId', { wordId })`.
- When filtering words by a linked example, use `innerJoin('w.examples', 'example', 'example.id = :exampleId', { exampleId })` — Word owns the join table so joins work from both sides.

**Detach vs. delete**
- `DELETE /words/:wordId/examples/:exId` → **detaches** the association only (join row removed; example row kept).
- `DELETE /examples/:exId` → **permanently** deletes the example row (cascades word associations via the join table).

**Audio**
- Audio is stored inline on `words` (`audio_file_url`, `audio_created_at`) and `examples` (same columns). There is no separate `audio_files` table.
- Audio is set via `PUT /words/:wordId/audio` and `PUT /words/:wordId/examples/:exId/audio`, and cleared via the corresponding `DELETE` routes. These return the updated parent object.
- One audio slot per word, one per example.

**Translations**
- Translations are stored as four nullable TEXT columns directly on the `words` and `examples` rows (`translation_fa`, `translation_en`, `translation_ru`, `translation_ar`). There are no separate translation tables.
- For words: `POST /translations` (409 if already set), `PATCH /translations/:lang` (always overwrites), `DELETE /translations/:lang` (nulls the column). All return the updated Word object.
- For examples: translations are set at creation time (`POST /examples`) via the `CreateExampleDto` body. There are no standalone example-translation CRUD routes.

**Service patterns**
- All repository getters are lazy (`private get wordRepo() { return AppDataSource.getRepository(Word); }`) — they are resolved after DB initialises.
- Errors thrown as `Object.assign(new Error(msg), { statusCode })` and caught by the global exception filter.
- The `requireWord` / `requireExample` private helpers centralise 404 logic. `requireExample(exId, wordId?)` verifies the M2M association exists when `wordId` is provided.
- Word translation logic uses a `langCol` map (`Record<LanguageCode, keyof Word>`) and a single `setWordTranslation(wordId, lang, translation, failIfExists?)` method — `failIfExists = true` gives POST-style 409 semantics, omitting it gives PATCH-style overwrite.

### Invitation Workflow

1. Admin creates invite → token stored in `invitation_tokens` (`email`, `token`, `expires_at`, `is_used`) → email sent via Resend SDK.
2. User clicks link → Google OAuth → token validated → account created as `pending_approval`.
3. Admin activates → Welcome email sent.
