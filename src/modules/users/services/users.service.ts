import { AppDataSource } from '../../../config/database.config';
import { resend } from '../../../config/email.config';
import { config } from '../../../config/env.config';
import { logger } from '../../../config/logger.config';
import { tokenService } from '../../auth/services/token.service';
import { User, UserStatus } from '../entities/user.entity';
import { InvitationToken } from '../../invitations/entities/invitation-token.entity';
import { welcomeEmailTemplate } from '../../../common/emails/welcome.template';

class UsersService {
  private get repo() {
    return AppDataSource.getRepository(User);
  }

  findAll(): Promise<User[]> {
    return this.repo.find({ relations: ['role'], order: { createdAt: 'DESC' } });
  }

  findPending(): Promise<User[]> {
    return this.repo.find({
      where: { status: UserStatus.PENDING_APPROVAL },
      relations: ['role'],
      order: { createdAt: 'ASC' },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['role', 'directPermissions'],
    });
  }

  async activateUser(id: string): Promise<User> {
    const user = await this.repo.findOneOrFail({ where: { id }, relations: ['role'] });

    if (user.status === UserStatus.ACTIVE) {
      throw Object.assign(new Error('User is already active'), { statusCode: 409 });
    }

    // ── Atomic transaction ─────────────────────────────────────────────────────
    // 1. Set user status to ACTIVE.
    // 2. Mark the user's invitation token as used — the admin's approval is the
    //    definitive moment the invite is "consumed", not the initial sign-in.
    // If any DB operation fails the whole block rolls back together.
    const activatedUser = await AppDataSource.transaction(async (manager) => {
      user.status = UserStatus.ACTIVE;
      const saved = await manager.save(User, user);

      // Find the most recent unused invitation for this email and consume it
      const invitation = await manager.findOne(InvitationToken, {
        where: { email: user.email, isUsed: false },
        order: { createdAt: 'DESC' },
      });
      if (invitation) {
        invitation.isUsed = true;
        await manager.save(InvitationToken, invitation);
      }

      return saved;
    });
    // ──────────────────────────────────────────────────────────────────────────

    // Clear Redis keys AFTER the transaction commits so state is always consistent
    await Promise.all([
      tokenService.clearUserSuspension(id),   // clear suspended:{id}
      tokenService.clearUserPending(id),       // clear pending:{id} (defensive)
    ]);

    // Welcome email only runs after a successful transaction + Redis cleanup.
    // Non-blocking: a failed email never rolls back the activation.
    this.sendWelcomeEmail(activatedUser).catch((err) =>
      logger.error({ message: 'Welcome email failed', userId: id, error: err }),
    );

    logger.info({ message: 'User activated', userId: id, email: user.email });
    return activatedUser;
  }

  async suspendUser(id: string): Promise<User> {
    const user = await this.repo.findOneOrFail({ where: { id } });

    if (user.status === UserStatus.SUSPENDED) {
      throw Object.assign(new Error('User is already suspended'), { statusCode: 409 });
    }

    user.status = UserStatus.SUSPENDED;
    await this.repo.save(user);

    // Instantly invalidate all active JWTs — checked on every authenticated request
    await tokenService.markUserSuspended(id);

    logger.info({ message: 'User suspended', userId: id, email: user.email });
    return user;
  }

  private async sendWelcomeEmail(user: User): Promise<void> {
    const { error } = await resend.emails.send({
      from: config.resend.fromEmail,
      to: user.email,
      subject: 'Welcome to Abrilingo — your account is approved!',
      html: welcomeEmailTemplate({
        firstName: user.firstName,
        loginUrl: `${config.clientUrl}/login`,
      }),
    });
    if (error) throw error;
  }
}

export const usersService = new UsersService();
