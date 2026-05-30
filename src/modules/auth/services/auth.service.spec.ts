import 'reflect-metadata';
import { authService } from './auth.service';
import { AppDataSource } from '../../../config/database.config';
import { User, UserStatus } from '../../users/entities/user.entity';
import { InvitationToken } from '../../invitations/entities/invitation-token.entity';
import {
  InvitationRequiredException,
  InvalidInvitationException,
  InvitationUsedException,
  InvitationExpiredException,
  InvitationEmailMismatchException,
} from '../../../common/errors/invitation.errors';

jest.mock('../../../config/database.config', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../config/redis.config', () => ({
  redisClient: {
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  },
}));
jest.mock('../../../config/email.config', () => ({
  resend: { emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }) } },
}));
jest.mock('../../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../config/env.config', () => ({
  config: {
    nodeEnv: 'test',
    clientUrl: 'http://localhost:3001',
    jwt: {
      accessSecret: 'test-access-secret',
      refreshSecret: 'test-refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    resend: { fromEmail: 'noreply@abrilingo.com', apiKey: '' },
    google: { clientId: '', clientSecret: '', callbackUrl: '' },
  },
}));

const mockUserRepo = {
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockInvitationRepo = {
  findOne: jest.fn(),
};

const mockQB = {
  innerJoin: jest.fn(),
  where: jest.fn(),
  andWhere: jest.fn(),
  getMany: jest.fn(),
};

function makeProfile(email: string, googleId = 'google-id-123') {
  return {
    id: googleId,
    emails: [{ value: email }],
    name: { givenName: 'Jane', familyName: 'Doe' },
    photos: [{ value: 'https://photo.example.com/avatar.jpg' }],
  };
}

describe('AuthService.findOrCreateFromGoogle — invitation validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === User) return mockUserRepo;
      if (entity === InvitationToken) return mockInvitationRepo;
      return {};
    });

    mockQB.innerJoin.mockReturnThis();
    mockQB.where.mockReturnThis();
    mockQB.andWhere.mockReturnThis();
    mockQB.getMany.mockResolvedValue([]);
    mockUserRepo.createQueryBuilder.mockReturnValue(mockQB);
    mockUserRepo.findOne.mockResolvedValue(null);
  });

  // ── Returning user ────────────────────────────────────────────────────────

  it('returns an existing user immediately without checking the invitation', async () => {
    const existing = { id: 'u1', googleId: 'google-id-123', email: 'returning@example.com', role: null };
    mockUserRepo.findOne.mockResolvedValue(existing);

    const result = await authService.findOrCreateFromGoogle(makeProfile('returning@example.com') as any);

    expect(result).toBe(existing);
    expect(mockInvitationRepo.findOne).not.toHaveBeenCalled();
  });

  // ── New user: invitation failures ─────────────────────────────────────────

  it('throws InvitationRequiredException when no invitationToken is provided', async () => {
    await expect(
      authService.findOrCreateFromGoogle(makeProfile('new@example.com') as any, undefined),
    ).rejects.toThrow(InvitationRequiredException);
  });

  it('throws InvalidInvitationException when the token does not exist in the DB', async () => {
    mockInvitationRepo.findOne.mockResolvedValue(null);

    await expect(
      authService.findOrCreateFromGoogle(makeProfile('new@example.com') as any, 'nonexistent-token'),
    ).rejects.toThrow(InvalidInvitationException);
  });

  it('throws InvitationUsedException when isUsed is true', async () => {
    mockInvitationRepo.findOne.mockResolvedValue({
      token: 'tok',
      email: 'new@example.com',
      isUsed: true,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      authService.findOrCreateFromGoogle(makeProfile('new@example.com') as any, 'tok'),
    ).rejects.toThrow(InvitationUsedException);
  });

  it('throws InvitationExpiredException when expiresAt is in the past', async () => {
    mockInvitationRepo.findOne.mockResolvedValue({
      token: 'tok',
      email: 'new@example.com',
      isUsed: false,
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      authService.findOrCreateFromGoogle(makeProfile('new@example.com') as any, 'tok'),
    ).rejects.toThrow(InvitationExpiredException);
  });

  it('reports InvitationUsedException (not expiry) when both conditions are true — isUsed is checked first', async () => {
    mockInvitationRepo.findOne.mockResolvedValue({
      token: 'tok',
      email: 'new@example.com',
      isUsed: true,
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      authService.findOrCreateFromGoogle(makeProfile('new@example.com') as any, 'tok'),
    ).rejects.toThrow(InvitationUsedException);
  });

  it('throws InvitationEmailMismatchException when the Google email differs from the invited email', async () => {
    mockInvitationRepo.findOne.mockResolvedValue({
      token: 'tok',
      email: 'other@example.com',
      isUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      authService.findOrCreateFromGoogle(makeProfile('new@example.com') as any, 'tok'),
    ).rejects.toThrow(InvitationEmailMismatchException);
  });

  // ── New user: success path ────────────────────────────────────────────────

  it('creates a PENDING_APPROVAL user on a valid invitation', async () => {
    mockInvitationRepo.findOne.mockResolvedValue({
      token: 'valid-tok',
      email: 'new@example.com',
      isUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const created = { id: 'u2', email: 'new@example.com', status: UserStatus.PENDING_APPROVAL, role: null };
    mockUserRepo.create.mockReturnValue(created);
    mockUserRepo.save.mockResolvedValue(created);
    mockUserRepo.findOneOrFail.mockResolvedValue(created);

    const result = await authService.findOrCreateFromGoogle(makeProfile('new@example.com') as any, 'valid-tok');

    expect(result.status).toBe(UserStatus.PENDING_APPROVAL);
    expect(mockUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: UserStatus.PENDING_APPROVAL }),
    );
  });

  it('does NOT mark invitation.isUsed at registration — that happens at admin activation', async () => {
    const invitation = {
      token: 'valid-tok',
      email: 'new@example.com',
      isUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
    };
    mockInvitationRepo.findOne.mockResolvedValue(invitation);

    const created = { id: 'u2', email: 'new@example.com', status: UserStatus.PENDING_APPROVAL, role: null };
    mockUserRepo.create.mockReturnValue(created);
    mockUserRepo.save.mockResolvedValue(created);
    mockUserRepo.findOneOrFail.mockResolvedValue(created);

    await authService.findOrCreateFromGoogle(makeProfile('new@example.com') as any, 'valid-tok');

    expect(invitation.isUsed).toBe(false);
  });
});
