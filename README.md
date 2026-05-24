# Abrilingo — Teacher Backend

> Modular Monolith · Auth & RBAC · REST API

Production-grade backend for the **Abrilingo teacher platform**. It implements invitation-only registration, manual admin approval, JWT session management with refresh token rotation, and role-based access control — all in a NestJS-inspired modular monolith designed to split into microservices when the time comes.

---

## Table of Contents

- [Architecture Stack](#architecture-stack)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Installation & Setup](#installation--setup)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Database Migrations](#database-migrations)
- [Super-Admin Bootstrap](#super-admin-bootstrap)
- [API Reference](#api-reference)
- [Auth & Session Flow](#auth--session-flow)
- [RBAC Model](#rbac-model)
- [Testing](#testing)
- [Future Microservices Migration](#future-microservices-migration)

---

## Architecture Stack

| Layer           | Technology                                             |
| --------------- | ------------------------------------------------------ |
| Runtime         | Node.js 20 + Express 4                                 |
| Language        | TypeScript 5 (strict mode)                             |
| ORM             | TypeORM 0.3 — **Data Mapper pattern**, migrations only |
| Primary DB      | PostgreSQL 16                                          |
| Cache / Session | Redis 7                                                |
| Auth            | Passport.js · Google OAuth2 · JWT (jsonwebtoken)       |
| Email           | Resend SDK                                             |
| Logging         | Winston                                                |
| Infrastructure  | Docker · docker-compose                                |
| Validation      | class-validator · class-transformer                    |

---

## Key Features

### Google OAuth2 — Invitation-only Registration

New users can only sign up if they have received a personal invitation email. A signed JWT is passed through the OAuth `state` parameter so the invitation token survives the Google round-trip tamper-proof. Attempting to sign up without a valid invite redirects the user to a descriptive error page.

### Manual Admin Approval Workflow

After completing Google OAuth, a new user's account is created with `pending_approval` status — they cannot log in yet. All active `SUPER_ADMIN` users receive an automated notification email. A `SUPER_ADMIN` then reviews the queue and explicitly activates or rejects each account.

### Advanced Session Management

- **Dual-token strategy** — short-lived Access Token (15 min) and long-lived Refresh Token (7 days) delivered exclusively as `HttpOnly · Secure · SameSite=Strict` cookies.
- **Refresh Token Rotation** — every `POST /api/auth/refresh` issues a brand-new pair and blacklists the old Refresh Token's `jti` in Redis. Reusing a rotated token is detected immediately.
- **Redis Blacklist** — tokens are revoked on logout and on user suspension. The jti is stored in Redis with a TTL equal to the token's remaining lifetime, so the keyspace never grows unboundedly.

### Dynamic RBAC with User-level Overrides

Permissions are linked to roles (`role_permissions`) but can also be granted directly to individual users (`user_permissions`). The `requireRoles()` guard handles role-level enforcement; per-user permission checks query the union of both tables.

---

## Project Structure

```
.
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
├── nodemon.json
├── jest.config.ts
└── src/
    ├── main.ts                        # Bootstrap: connect DB + Redis, start server
    ├── app.ts                         # Express factory: CORS, Helmet, routes, error filter
    ├── config/
    │   ├── database.config.ts         # TypeORM DataSource (synchronize: false)
    │   ├── email.config.ts            # Resend singleton
    │   ├── env.config.ts              # Typed environment variables
    │   ├── logger.config.ts           # Winston (pretty dev / JSON prod)
    │   └── redis.config.ts            # ioredis client
    ├── common/
    │   ├── emails/
    │   │   ├── invitation.template.ts
    │   │   ├── pending-approval.template.ts
    │   │   └── welcome.template.ts
    │   ├── errors/
    │   │   └── invitation.errors.ts   # InvitationExpiredException, InvalidInvitationException …
    │   ├── filters/
    │   │   └── global-exception.filter.ts  # Unified { statusCode, message, error, timestamp }
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts      # Verifies access token + Redis blacklist + suspension
    │   │   └── roles.guard.ts         # requireRoles(...RoleName) middleware factory
    │   ├── middleware/
    │   │   └── validate-body.middleware.ts  # class-validator DTO pipe
    │   └── utils/
    │       └── async-handler.ts       # Routes async errors to globalExceptionFilter
    ├── migrations/
    │   └── 1778716800000-InitialSchema.ts
    ├── scripts/
    │   └── seed-admin.ts              # One-time super-admin bootstrap (npm run seed:admin)
    ├── modules/
    │   ├── auth/
    │   │   ├── controllers/auth.controller.ts
    │   │   ├── services/
    │   │   │   ├── auth.service.ts    # OAuth user find/create, admin notification, logout
    │   │   │   └── token.service.ts   # JWT sign/verify, cookies, Redis blacklist & suspension
    │   │   ├── strategies/
    │   │   │   └── google.strategy.ts
    │   │   └── types/jwt-payload.type.ts
    │   ├── invitations/
    │   │   ├── controllers/invitation.controller.ts
    │   │   ├── dtos/create-invitation.dto.ts
    │   │   ├── entities/invitation-token.entity.ts
    │   │   └── services/invitation.service.ts
    │   ├── roles/
    │   │   └── entities/
    │   │       ├── role.entity.ts     # RoleName enum: SUPER_ADMIN | TEACHER | OPERATOR
    │   │       └── permission.entity.ts
    │   └── users/
    │       ├── controllers/users.controller.ts
    │       ├── entities/user.entity.ts  # UserStatus enum: pending_approval | active | suspended
    │       └── services/users.service.ts
    └── types/
        └── express.d.ts               # Adds req.jwtPayload to Express Request
```

---

## Installation & Setup

### Prerequisites

- Node.js ≥ 20
- Docker & Docker Compose

### 1 — Clone and install dependencies

```bash
git clone <repo-url>
cd teacher/backend
npm install
```

### 2 — Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the three external credentials:

| Variable               | Where to get it                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client ID                        |
| `GOOGLE_CLIENT_SECRET` | Same credential entry                                                                                                                  |
| `GOOGLE_CALLBACK_URL`  | Must match the **Authorised redirect URI** registered in Google Cloud (`http://localhost:3000/api/auth/google/callback` for local dev) |
| `RESEND_API_KEY`       | [resend.com](https://resend.com) → API Keys                                                                                            |
| `RESEND_FROM_EMAIL`    | A verified sender domain address in your Resend account                                                                                |
| `JWT_ACCESS_SECRET`    | Any long random string — `openssl rand -hex 32`                                                                                        |
| `JWT_REFRESH_SECRET`   | A **different** long random string — `openssl rand -hex 32`                                                                            |

The remaining variables (`DB_*`, `REDIS_*`, `PORT`) match the docker-compose defaults and do not need to change for local development.

---

## Running the Application

### Start infrastructure (Postgres + Redis)

```bash
docker-compose up -d
```

Both services expose health checks. Wait a few seconds before running the app.

### Development (hot-reload)

```bash
npm run dev
```

The server starts on `http://localhost:3000`. Winston logs are pretty-printed in development.

### Production build

```bash
npm run build
npm start
```

---

## API Documentation

Interactive Swagger UI (OpenAPI 3.0) is served at `/api/docs`. The raw JSON spec is available at `/api/docs.json` and can be imported directly into Postman or other API clients.

| Environment   | URL                              | Default availability                      |
| ------------- | -------------------------------- | ----------------------------------------- |
| `development` | `http://localhost:3000/api/docs` | Always on                                 |
| `staging`     | `<APP_URL>/api/docs`             | Always on                                 |
| `production`  | `<APP_URL>/api/docs`             | Off — set `ENABLE_SWAGGER=true` to enable |

### Enabling in production

```bash
ENABLE_SWAGGER=true npm start
```

### Authentication in Swagger UI

All authenticated endpoints use the `access_token` HttpOnly cookie. Swagger UI is pre-configured with `withCredentials: true`, so the cookie is sent automatically once set.

To test authenticated endpoints:

1. Open `GET /api/auth/google` in your browser to complete the Google OAuth flow.
2. The server sets the `access_token` cookie automatically on successful login.
3. Return to Swagger UI — the cookie is now sent on all **Try It Out** requests from the same origin.

For `curl` or Postman, copy the cookie value from browser DevTools and pass it as a header:

```
Cookie: access_token=<your-token>
```

---

## Database Migrations

TypeORM migrations are the **only** way schema changes are applied — `synchronize: false` is enforced.

```bash
# Apply all pending migrations
npm run migration:run

# Generate a new migration after editing entities
npm run migration:generate -- src/migrations/DescriptiveName

# Roll back the last applied migration
npm run migration:revert
```

> **First run:** execute `migration:run` after `docker-compose up -d` to create all tables.

> **Note:** All migration commands load `.env` automatically. If you use a non-default `DB_PORT` or `DB_PASSWORD` (e.g. a Docker-mapped port), make sure `.env` is present before running CLI commands — do not rely on a globally installed PostgreSQL picking up the defaults.

---

## Super-Admin Bootstrap

The system uses **invitation-only registration**, which creates a bootstrap problem: the first `SUPER_ADMIN` cannot register through the normal flow because there is no one to send the invitation. Use the seed script to create the initial admin account directly from the database.

### 1 — Add the bootstrap variables to `.env`

```dotenv
SUPER_ADMIN_EMAIL=your.email@gmail.com
SUPER_ADMIN_GOOGLE_ID=1234567890123456789
SUPER_ADMIN_FIRST_NAME=Your First Name   # optional, defaults to "Super"
SUPER_ADMIN_LAST_NAME=Your Last Name     # optional, defaults to "Admin"
```

**Finding your Google sub ID (`SUPER_ADMIN_GOOGLE_ID`):**

The sub ID is the unique numeric identifier Google attaches to every account. Follow these three steps to retrieve it.

#### Step 1 — Generate the token in Google OAuth Playground

1. Go to [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground).
2. In the left panel, find **Google OAuth2 API v2** and tick the boxes for `openid`, `email`, and `profile`.
3. Click **Authorize APIs**, log in with your Google account, and confirm the permissions.
4. Once redirected back, click **Exchange authorization code for tokens**.

#### Step 2 — Copy the `id_token`

In the right-hand panel, locate the `"id_token"` field in the response JSON. Copy the entire long string next to it (it starts with `eyJ`).

#### Step 3 — Decode on JWT.io

1. Go to [jwt.io](https://jwt.io).
2. Paste the copied string into the **Encoded** box on the left.
3. In the **Decoded** panel on the right, look at the **Payload** section. The long number next to `"sub"` is your Google ID — paste it as `SUPER_ADMIN_GOOGLE_ID`.

### 2 — Run migrations (if not already done)

```bash
npm run migration:run
```

### 3 — Seed the super-admin

```bash
npm run seed:admin
```

Expected output:

```
[seed:admin] Database connection established.
[seed:admin] SUPER_ADMIN role created (id: <uuid>).
[seed:admin] Super-admin user CREATED.

[seed:admin] ✔ Done.
─────────────────────────────────────────
  id      : <uuid>
  email   : your.email@gmail.com
  role    : SUPER_ADMIN
  status  : active
─────────────────────────────────────────
```

The script is **idempotent** — running it again updates the existing account's role and status to `SUPER_ADMIN / active` without creating a duplicate.

Once the super-admin account exists, all subsequent users can be onboarded through the normal invitation flow via `POST /api/invitations`.

---

## API Reference

All responses use a consistent error envelope:

```json
{ "statusCode": 400, "message": "...", "error": "Bad Request", "timestamp": "2026-05-14T..." }
```

Authentication is cookie-based. The browser sends `access_token` and `refresh_token` cookies automatically; no `Authorization` header is needed.

### Auth

| Method | Path                        | Auth   | Description                                                           |
| ------ | --------------------------- | ------ | --------------------------------------------------------------------- |
| `GET`  | `/api/auth/google`          | Public | Redirects to Google OAuth. Pass `?invitationToken=xxx` for new users. |
| `GET`  | `/api/auth/google/callback` | Public | Google callback — sets HttpOnly cookies, redirects to frontend.       |
| `POST` | `/api/auth/refresh`         | Cookie | Rotates the token pair. Old refresh jti is blacklisted immediately.   |
| `POST` | `/api/auth/logout`          | Cookie | Blacklists both tokens, clears cookies.                               |

### Invitations

| Method | Path               | Auth          | Description                                                                                         |
| ------ | ------------------ | ------------- | --------------------------------------------------------------------------------------------------- |
| `POST` | `/api/invitations` | `SUPER_ADMIN` | Creates a 7-day token and sends a branded invite email via Resend. Rate-limited to 20 req / 15 min. |
| `GET`  | `/api/invitations` | `SUPER_ADMIN` | Lists all sent invitations with status.                                                             |

**Request body for `POST /api/invitations`:**

```json
{ "email": "teacher@example.com" }
```

### Users

| Method  | Path                      | Auth                      | Description                                                                                               |
| ------- | ------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET`   | `/api/users`              | `SUPER_ADMIN`, `OPERATOR` | List all users with roles.                                                                                |
| `GET`   | `/api/users/pending`      | `SUPER_ADMIN`, `OPERATOR` | List users awaiting approval.                                                                             |
| `GET`   | `/api/users/:id`          | `SUPER_ADMIN`, `OPERATOR` | Get a single user with role and direct permissions.                                                       |
| `PATCH` | `/api/users/:id/activate` | `SUPER_ADMIN`             | Atomic activation: sets status → `active`, marks invitation used, clears Redis keys, sends welcome email. |
| `PATCH` | `/api/users/:id/suspend`  | `SUPER_ADMIN`             | Sets status → `suspended` and writes `suspended:{id}` to Redis for instant token revocation.              |

### Health

| Method | Path      | Auth   | Description                            |
| ------ | --------- | ------ | -------------------------------------- |
| `GET`  | `/health` | Public | Returns `{ status: "ok", env: "..." }` |

---

## Auth & Session Flow

```
1. INVITE
   SUPER_ADMIN ──POST /api/invitations──► DB: invitation_tokens
                                          Resend: invitation email → user

2. REGISTER
   User clicks link ──► /accept-invite?token=xxx  (frontend)
         │
         ▼
   GET /api/auth/google?invitationToken=xxx
         │  token encoded in signed JWT state
         ▼
   Google OAuth ──callback──► invitation validated
                               User created  (status: pending_approval)
                               SUPER_ADMINs notified via email

3. APPROVE
   SUPER_ADMIN ──PATCH /api/users/:id/activate
         │
         ▼
   DB transaction {
     user.status = ACTIVE
     invitation.isUsed = true
   }
   Redis: del suspended:{id}, del pending:{id}
   Resend: welcome email → user

4. LOGIN (subsequent visits)
   GET /api/auth/google  (no invitationToken needed)
         │  existing user found
         ▼
   Access Token  (15 min) ─┐
   Refresh Token (7 days)  ─┤── HttpOnly · Secure · SameSite=Strict cookies
         │
         ▼
   Redirect → /dashboard

5. REFRESH
   POST /api/auth/refresh
   ├── verify refresh token signature
   ├── check Redis blacklist (jti)
   ├── blacklist old jti (remaining TTL)
   └── issue new access + refresh pair → set new cookies

6. SUSPEND
   PATCH /api/users/:id/suspend
   ├── user.status = SUSPENDED  (DB)
   └── Redis: set suspended:{id}  ← checked on every authenticated request
             next JWT guard check → 401 Unauthorized, cookies cleared
```

---

## RBAC Model

```
Roles:  SUPER_ADMIN  │  OPERATOR  │  TEACHER
                     │
              role_permissions (join table)
                     │
              Permission  ◄──  user_permissions (direct overrides)
                     │
              User ──────────────────────────────►  req.jwtPayload
```

**Effective permissions** = `role.permissions` ∪ `user.directPermissions`

**Guard usage in route files:**

```typescript
import { jwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { requireRoles } from '../common/guards/roles.guard';
import { RoleName } from '../modules/roles/entities/role.entity';

router.patch(
  '/:id/activate',
  jwtAuthGuard, // validates JWT, checks Redis blacklist & suspension
  requireRoles(RoleName.SUPER_ADMIN), // rejects 403 if role doesn't match
  asyncHandler(handler),
);
```

---

## Testing

The test stack uses **Jest** with `ts-jest` and `reflect-metadata` bootstrapped before each suite.

```bash
# Run the full test suite
npm test

# Run a single test file
npm test -- --testPathPattern=auth.service

# Run with coverage report
npm run test:coverage
```

Tests are co-located with their modules:

```
src/modules/auth/services/auth.service.spec.ts
src/modules/users/services/users.service.spec.ts
src/modules/invitations/services/invitation.service.spec.ts
```

**Unit tests** mock `AppDataSource` repositories and the Resend client. **Integration tests** connect to a real Postgres and Redis instance (spin up `docker-compose up -d` first).

Coverage is collected from `src/**/*.ts`, excluding spec files.

---

## Future Microservices Migration

The codebase is structured as a **Modular Monolith** — every business domain (`auth`, `users`, `invitations`, `roles`) is fully self-contained with its own controllers, services, entities, DTOs, and repositories. There are no cross-module direct imports at the service layer; modules interact only through their public service interfaces or shared database entities.

When traffic or team size justifies it, each module can be extracted into an independent microservice by:

1. Moving the module folder into its own repository.
2. Replacing direct service calls with an async message broker (e.g., RabbitMQ, Kafka) or a synchronous HTTP/gRPC client.
3. Splitting the single Postgres database into per-service databases.
4. Keeping the Redis layer shared (for token blacklisting and session state) or federating it per domain.

The TypeORM Data Mapper pattern means entities have zero business logic — they are plain data containers that migrate cleanly between deployment models.

---

## Environment Variable Reference

| Variable                 | Default                 | Required |
| ------------------------ | ----------------------- | -------- |
| `NODE_ENV`               | `development`           | —        |
| `PORT`                   | `3000`                  | —        |
| `APP_URL`                | `http://localhost:3000` | —        |
| `CLIENT_URL`             | `http://localhost:3001` | —        |
| `DB_HOST`                | `localhost`             | —        |
| `DB_PORT`                | `5432`                  | —        |
| `DB_NAME`                | `abrilingo_teacher`     | —        |
| `DB_USER`                | `postgres`              | —        |
| `DB_PASSWORD`            | `postgres`              | —        |
| `REDIS_HOST`             | `localhost`             | —        |
| `REDIS_PORT`             | `6379`                  | —        |
| `JWT_ACCESS_SECRET`      | —                       | **Yes**  |
| `JWT_REFRESH_SECRET`     | —                       | **Yes**  |
| `JWT_ACCESS_EXPIRES_IN`  | `15m`                   | —        |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                    | —        |
| `GOOGLE_CLIENT_ID`       | —                       | **Yes**  |
| `GOOGLE_CLIENT_SECRET`   | —                       | **Yes**  |
| `GOOGLE_CALLBACK_URL`    | —                       | **Yes**  |
| `RESEND_API_KEY`         | —                       | **Yes**      |
| `RESEND_FROM_EMAIL`      | `noreply@abrilingo.com` | **Yes**      |
| `ENABLE_SWAGGER`         | —                       | —            |
| `SUPER_ADMIN_EMAIL`      | —                       | Seed only    |
| `SUPER_ADMIN_GOOGLE_ID`  | —                       | Seed only    |
| `SUPER_ADMIN_FIRST_NAME` | `Super`                 | —            |
| `SUPER_ADMIN_LAST_NAME`  | `Admin`                 | —            |
