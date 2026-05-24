import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { AppDataSource } from '../config/database.config';
import { Role, RoleName } from '../modules/roles/entities/role.entity';
import { User, UserStatus } from '../modules/users/entities/user.entity';

// ── Validate required env vars ────────────────────────────────────────────────

const email     = process.env.SUPER_ADMIN_EMAIL;
const googleId  = process.env.SUPER_ADMIN_GOOGLE_ID;
const firstName = process.env.SUPER_ADMIN_FIRST_NAME ?? 'Super';
const lastName  = process.env.SUPER_ADMIN_LAST_NAME  ?? 'Admin';

const missing: string[] = [];
if (!email)    missing.push('SUPER_ADMIN_EMAIL');
if (!googleId) missing.push('SUPER_ADMIN_GOOGLE_ID');

if (missing.length > 0) {
  console.error(
    `[seed:admin] ERROR — missing required env var(s): ${missing.join(', ')}\n` +
    `  Set them in .env or export them before running this script.`,
  );
  process.exit(1);
}

// ── Seed logic ────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('[seed:admin] Database connection established.');

  const roleRepo = AppDataSource.getRepository(Role);
  const userRepo = AppDataSource.getRepository(User);

  // Find or create SUPER_ADMIN role
  let superAdminRole = await roleRepo.findOne({ where: { name: RoleName.SUPER_ADMIN } });

  if (!superAdminRole) {
    superAdminRole = await roleRepo.save(
      roleRepo.create({ name: RoleName.SUPER_ADMIN, description: 'Full platform access' }),
    );
    console.log(`[seed:admin] SUPER_ADMIN role created (id: ${superAdminRole.id}).`);
  } else {
    console.log(`[seed:admin] SUPER_ADMIN role already exists (id: ${superAdminRole.id}).`);
  }

  // Find by email OR googleId to avoid unique-constraint collisions on either column
  let user = await userRepo.findOne({
    where: [{ email: email! }, { googleId: googleId! }],
    relations: ['role'],
  });

  if (!user) {
    user = await userRepo.save(
      userRepo.create({
        email:     email!,
        googleId:  googleId!,
        firstName,
        lastName,
        avatarUrl: null,
        status:    UserStatus.ACTIVE,
        role:      superAdminRole,
      }),
    );
    console.log('[seed:admin] Super-admin user CREATED.');
  } else {
    user.role   = superAdminRole;
    user.status = UserStatus.ACTIVE;
    if (!user.googleId) user.googleId = googleId!; // backfill only if empty
    user = await userRepo.save(user);
    console.log('[seed:admin] Super-admin user already exists — role and status updated.');
  }

  console.log('\n[seed:admin] ✔ Done.');
  console.log('─────────────────────────────────────────');
  console.log(`  id      : ${user.id}`);
  console.log(`  email   : ${user.email}`);
  console.log(`  role    : ${user.role?.name ?? RoleName.SUPER_ADMIN}`);
  console.log(`  status  : ${user.status}`);
  console.log('─────────────────────────────────────────\n');
}

seed()
  .catch((err: unknown) => {
    console.error('[seed:admin] FATAL —', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      console.log('[seed:admin] Database connection closed.');
    }
  });
