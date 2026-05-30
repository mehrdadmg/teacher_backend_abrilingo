import { Response } from 'express';
import { Profile } from 'passport-google-oauth20';
import { AppDataSource } from '../../../config/database.config';
import { resend } from '../../../config/email.config';
import { config } from '../../../config/env.config';
import { logger } from '../../../config/logger.config';
import { User, UserStatus } from '../../users/entities/user.entity';
import { InvitationToken } from '../../invitations/entities/invitation-token.entity';
import { RoleName } from '../../roles/entities/role.entity';
import { tokenService } from './token.service';
import { JwtPayload } from '../types/jwt-payload.type';
import {
  InvitationRequiredException,
  InvalidInvitationException,
  InvitationUsedException,
  InvitationExpiredException,
  InvitationEmailMismatchException,
} from '../../../common/errors/invitation.errors';
import { pendingApprovalNotificationTemplate } from '../../../common/emails/pending-approval.template';

class AuthService {
  private get userRepo() {
    return AppDataSource.getRepository(User);
  }

  private get invitationRepo() {
    return AppDataSource.getRepository(InvitationToken);
  }

  async findOrCreateFromGoogle(profile: Profile, invitationToken?: string): Promise<User> {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new Error('Google account provided no email address');

    // Returning user — look up by Google ID or email
    let user = await this.userRepo.findOne({
      where: [{ googleId: profile.id }, { email }],
      relations: ['role'],
    });

    if (user) {
      // Backfill googleId if the user originally registered a different way
      if (!user.googleId) {
        user.googleId = profile.id;
        await this.userRepo.save(user);
      }
      return user;
    }

    // New user — a valid invitation is mandatory
    await this.validateInvitation(invitationToken, email);

    user = this.userRepo.create({
      email,
      googleId: profile.id,
      firstName: profile.name?.givenName ?? '',
      lastName: profile.name?.familyName ?? '',
      avatarUrl: profile.photos?.[0]?.value ?? null,
      status: UserStatus.PENDING_APPROVAL,
    });

    // Save the user only. The invitation is marked `isUsed` atomically
    // during activation (UsersService.activateUser) so the admin's approval
    // is the definitive moment the token is "consumed".
    await this.userRepo.save(user);

    const savedUser = await this.userRepo.findOneOrFail({ where: { id: user.id }, relations: ['role'] });

    // Notify all active SUPER_ADMINs — fire and forget, never blocks registration
    this.notifyAdminsOfPendingUser(savedUser).catch((err) =>
      logger.error({ message: 'Admin pending-approval notification failed', userId: savedUser.id, error: err }),
    );

    logger.info({ message: 'New user registered, pending approval', userId: savedUser.id, email });
    return savedUser;
  }

  async logout(accessToken?: string, refreshToken?: string, res?: Response): Promise<void> {
    const pairs: Array<{ token?: string; verify: (t: string) => JwtPayload }> = [
      { token: accessToken, verify: (t) => tokenService.verifyAccessToken(t) },
      { token: refreshToken, verify: (t) => tokenService.verifyRefreshToken(t) },
    ];

    for (const { token, verify } of pairs) {
      if (!token) continue;
      try {
        const payload = verify(token);
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        await tokenService.blacklistToken(payload.jti, ttl);
      } catch {
        // Already expired or tampered — nothing to revoke
      }
    }

    if (res) tokenService.clearAuthCookies(res);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async validateInvitation(token: string | undefined, email: string): Promise<void> {
    if (!token) throw new InvitationRequiredException();

    const invitation = await this.invitationRepo.findOne({ where: { token } });

    if (!invitation) throw new InvalidInvitationException();

    // Check isUsed BEFORE expiresAt so we return the most accurate reason
    if (invitation.isUsed) throw new InvitationUsedException();
    if (invitation.expiresAt < new Date()) throw new InvitationExpiredException();

    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      throw new InvitationEmailMismatchException();
    }
  }

  private async notifyAdminsOfPendingUser(newUser: User): Promise<void> {
    const admins = await this.userRepo
      .createQueryBuilder('user')
      .innerJoin('user.role', 'role')
      .where('role.name = :name', { name: RoleName.SUPER_ADMIN })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .getMany();

    if (admins.length === 0) {
      logger.warn({ message: 'No active SUPER_ADMIN found to notify of pending user', userId: newUser.id });
      return;
    }

    const reviewUrl = `${config.clientUrl}/admin/users/pending`;
    const newUserName = `${newUser.firstName} ${newUser.lastName}`.trim() || newUser.email;

    // Use allSettled so a single failed send doesn't suppress the rest
    const results = await Promise.allSettled(
      admins.map(async (admin) => {
        const { error } = await resend.emails.send({
          from: config.resend.fromEmail,
          to: admin.email,
          subject: `[Abrilingo] New user awaiting approval: ${newUserName}`,
          html: pendingApprovalNotificationTemplate({
            adminName: admin.firstName,
            newUserName,
            newUserEmail: newUser.email,
            reviewUrl,
          }),
        });
        if (error) throw error;
      }),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn({ message: `${failed}/${admins.length} admin notification emails failed`, userId: newUser.id });
    }
  }
}

export const authService = new AuthService();
