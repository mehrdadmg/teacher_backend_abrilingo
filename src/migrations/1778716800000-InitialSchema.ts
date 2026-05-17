import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1778716800000 implements MigrationInterface {
  name = 'InitialSchema1778716800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."users_status_enum"
        AS ENUM ('pending_approval', 'active', 'suspended')
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."roles_name_enum"
        AS ENUM ('SUPER_ADMIN', 'TEACHER', 'OPERATOR')
    `);

    await queryRunner.query(`
      CREATE TABLE "permissions" (
        "id"          uuid                NOT NULL DEFAULT gen_random_uuid(),
        "name"        character varying   NOT NULL,
        "description" character varying,
        "created_at"  TIMESTAMP           NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP           NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_permissions_name" UNIQUE ("name"),
        CONSTRAINT "PK_permissions"      PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id"          uuid                        NOT NULL DEFAULT gen_random_uuid(),
        "name"        "public"."roles_name_enum"  NOT NULL,
        "description" character varying,
        "created_at"  TIMESTAMP                   NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMP                   NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_roles_name" UNIQUE ("name"),
        CONSTRAINT "PK_roles"      PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"         uuid                         NOT NULL DEFAULT gen_random_uuid(),
        "email"      character varying            NOT NULL,
        "google_id"  character varying            NOT NULL,
        "first_name" character varying            NOT NULL,
        "last_name"  character varying            NOT NULL,
        "avatar_url" character varying,
        "status"     "public"."users_status_enum" NOT NULL DEFAULT 'pending_approval',
        "role_id"    uuid,
        "created_at" TIMESTAMP                    NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP                    NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email"     UNIQUE ("email"),
        CONSTRAINT "UQ_users_google_id" UNIQUE ("google_id"),
        CONSTRAINT "PK_users"           PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permissions" (
        "role_id"       uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_role_permissions" PRIMARY KEY ("role_id", "permission_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "user_permissions" (
        "user_id"       uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        CONSTRAINT "PK_user_permissions" PRIMARY KEY ("user_id", "permission_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "invitation_tokens" (
        "id"              uuid              NOT NULL DEFAULT gen_random_uuid(),
        "email"           character varying NOT NULL,
        "token"           character varying NOT NULL,
        "expires_at"      TIMESTAMP         NOT NULL,
        "is_used"         boolean           NOT NULL DEFAULT false,
        "invited_by_id"   uuid,
        "created_at"      TIMESTAMP         NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_invitation_tokens_token" UNIQUE ("token"),
        CONSTRAINT "PK_invitation_tokens"       PRIMARY KEY ("id")
      )
    `);

    // Foreign keys
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "FK_users_role_id"
        FOREIGN KEY ("role_id") REFERENCES "roles"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "role_permissions"
        ADD CONSTRAINT "FK_role_permissions_role_id"
        FOREIGN KEY ("role_id") REFERENCES "roles"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "role_permissions"
        ADD CONSTRAINT "FK_role_permissions_permission_id"
        FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_permissions"
        ADD CONSTRAINT "FK_user_permissions_user_id"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_permissions"
        ADD CONSTRAINT "FK_user_permissions_permission_id"
        FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "invitation_tokens"
        ADD CONSTRAINT "FK_invitation_tokens_invited_by_id"
        FOREIGN KEY ("invited_by_id") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "invitation_tokens" DROP CONSTRAINT "FK_invitation_tokens_invited_by_id"`);
    await queryRunner.query(`ALTER TABLE "user_permissions"   DROP CONSTRAINT "FK_user_permissions_permission_id"`);
    await queryRunner.query(`ALTER TABLE "user_permissions"   DROP CONSTRAINT "FK_user_permissions_user_id"`);
    await queryRunner.query(`ALTER TABLE "role_permissions"   DROP CONSTRAINT "FK_role_permissions_permission_id"`);
    await queryRunner.query(`ALTER TABLE "role_permissions"   DROP CONSTRAINT "FK_role_permissions_role_id"`);
    await queryRunner.query(`ALTER TABLE "users"              DROP CONSTRAINT "FK_users_role_id"`);

    await queryRunner.query(`DROP TABLE "invitation_tokens"`);
    await queryRunner.query(`DROP TABLE "user_permissions"`);
    await queryRunner.query(`DROP TABLE "role_permissions"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "permissions"`);

    await queryRunner.query(`DROP TYPE "public"."roles_name_enum"`);
    await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
  }
}
