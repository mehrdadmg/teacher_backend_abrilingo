1. Project Architecture & Structure
   Pattern: Modular Monolith (Separation of concerns for future microservices migration).
   Folder Structure: Follow NestJS-like Layered Architecture:
   src/modules/[module-name]/ (e.g., Auth, Users, Invitations)
   Inside each module: controllers/, services/, entities/, dtos/, repositories/.
   Logic Separation:
   Controllers: Request/Response handling.
   Services: Core Business Logic.
   Repositories: Use TypeORM Data Mapper pattern.
   Guards/Middlewares: Permission & Auth checks.
2. Tech Stack
   Core: Node.js + Express + TypeScript + (nodemon, .env).
   Database: PostgreSQL (Primary) + Redis (Session/Blacklist).
   ORM: TypeORM with Strict Migration Strategy (Do NOT use synchronize: true. All changes must be handled via TypeORM Migrations).
   DevOps: Docker & Docker-compose (App, Postgres, Redis).
3. Authentication & Session Strategy
   OAuth: Only Google Login via passport-google-oauth20.
   Session Management:
   JWT Strategy: Access Token (Short-lived) + Refresh Token (Long-lived).
   Security: Tokens delivered via HttpOnly, Secure, SameSite=Strict Cookies.
   Refresh Token Rotation: Issue a new Refresh Token on every rotation; old ones must be invalidated.
   Revocation: Implement a Redis Blacklist to instantly revoke tokens (for Logouts or User Blocking).
   Payload: JWT must include userId, role, and a unique jti.
4. Dynamic Authorization (RBAC)
   Roles: SUPER_ADMIN, TEACHER, OPERATOR.
   Hybrid Permissions:
   Roles linked to Permissions.
   Direct User-to-Permission overrides (Table: user_permissions).
   Implementation: Custom Decorators/Guards to verify if a user has a specific permission or role.
5. Invitation & Approval Workflow (The Business Logic)
   Invitation: Admin generates a unique link (Table: invitation_tokens with email, token, expires_at, is_used).
   Email: Send invitation via Resend SDK with a branded HTML template.
   Registration: User signs in via Google -> Link is validated -> User created with status: pending_approval.
   Final Approval: Admin reviews pending_approval users -> Activates account -> User receives a "Welcome" email.
6. Security, Validation & Logging
   Validation: Use class-validator and class-transformer for all DTOs.
   Global Exception Filter: All errors must return: { "statusCode": 400, "message": "...", "error": "...", "timestamp": "..." }.
   Middlewares: Helmet for headers, Rate-limit for invitation endpoints.
   Logging: Structured logging using Winston or Pino.
7. Deliverables
   Folder Structure overview.
   TypeORM Entities for Users, Roles, Permissions, and Invitations.
   Google OAuth Strategy implementation.
   Migration Configuration and a sample migration file.
   Docker-compose.yml and .env.example.
