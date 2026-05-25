import crypto from 'crypto';
import { AppDataSource } from '../../../config/database.config';
import { resend } from '../../../config/email.config';
import { config } from '../../../config/env.config';
import { logger } from '../../../config/logger.config';
import { InvitationToken } from '../entities/invitation-token.entity';
import { User } from '../../users/entities/user.entity';
import { invitationEmailTemplate } from '../../../common/emails/invitation.template';

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

class InvitationService {
  private get repo() {
    return AppDataSource.getRepository(InvitationToken);
  }

  private get userRepo() {
    return AppDataSource.getRepository(User);
  }

  async createAndSend(email: string, invitedById: string): Promise<InvitationToken> {
    const existing = await this.repo.findOne({
      where: { email, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (existing && existing.expiresAt > new Date()) {
      const err = new Error('An active invitation already exists for this email');
      Object.assign(err, { statusCode: 409 });
      throw err;
    }

    const invitedBy = await this.userRepo.findOneOrFail({ where: { id: invitedById } });
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

    const invitation = this.repo.create({
      email,
      token,
      expiresAt,
      invitedBy: { id: invitedById },
    });
    await this.repo.save(invitation);

    const inviteLink = `${config.clientUrl}/accept-invite?token=${token}`;
    const invitedByName = `${invitedBy.firstName} ${invitedBy.lastName}`.trim();

    try {
      await resend.emails.send({
        from: config.resend.fromEmail,
        to: email,
        subject: `${invitedByName} invited you to join Abrilingo`,
        html: invitationEmailTemplate({ inviteLink, invitedByName, recipientEmail: email }),
      });
    } catch (emailError) {
      // Compensate: remove the invitation so admin can retry cleanly
      await this.repo.delete(invitation.id);
      logger.error({ message: 'Failed to send invitation email', email, error: emailError });
      const err = new Error('Failed to send invitation email — please try again');
      Object.assign(err, { statusCode: 502 });
      throw err;
    }

    logger.info({ message: 'Invitation sent', email, invitedById });
    return invitation;
  }

  findAll(): Promise<InvitationToken[]> {
    return this.repo.find({
      relations: ['invitedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async delete(id: string): Promise<void> {
    const invitation = await this.repo.findOne({ where: { id } });

    if (!invitation) {
      throw Object.assign(new Error('Invitation not found'), { statusCode: 404 });
    }

    if (invitation.isUsed) {
      throw Object.assign(
        new Error('Cannot delete an invitation that has already been used'),
        { statusCode: 409 },
      );
    }

    await this.repo.delete(id);
    logger.info({ message: 'Invitation deleted', invitationId: id });
  }
}

export const invitationService = new InvitationService();
