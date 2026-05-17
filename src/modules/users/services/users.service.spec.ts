import 'reflect-metadata';
import { usersService } from './users.service';
import { AppDataSource } from '../../../config/database.config';
import { User, UserStatus } from '../entities/user.entity';
import { InvitationToken } from '../../invitations/entities/invitation-token.entity';
import { tokenService } from '../../auth/services/token.service';

jest.mock('../../../config/database.config', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    transaction: jest.fn(),
  },
}));
jest.mock('../../../config/email.config', () => ({
  resend: { emails: { send: jest.fn().mockResolvedValue({ id: 'email-id' }) } },
}));
jest.mock('../../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../config/env.config', () => ({
  config: {
    nodeEnv: 'test',
    clientUrl: 'http://localhost:3001',
    resend: { fromEmail: 'noreply@abrilingo.com', apiKey: '' },
  },
}));
jest.mock('../../auth/services/token.service', () => ({
  tokenService: {
    clearUserSuspension: jest.fn(),
    clearUserPending: jest.fn(),
    markUserSuspended: jest.fn(),
  },
}));

const mockUserRepo = {
  findOneOrFail: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
};

function pendingUser(id = 'u1'): User {
  return {
    id,
    email: 'teacher@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    googleId: 'gid-1',
    avatarUrl: null,
    status: UserStatus.PENDING_APPROVAL,
    role: null,
    directPermissions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;
}

describe('UsersService.activateUser — atomic transaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockUserRepo);
    (tokenService.clearUserSuspension as jest.Mock).mockResolvedValue(undefined);
    (tokenService.clearUserPending as jest.Mock).mockResolvedValue(undefined);
  });

  // ── Success path ──────────────────────────────────────────────────────────

  it('saves user with ACTIVE status inside the transaction', async () => {
    const user = pendingUser();
    mockUserRepo.findOneOrFail.mockResolvedValue(user);

    const mockManager = {
      save: jest.fn().mockResolvedValue({ ...user, status: UserStatus.ACTIVE }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    (AppDataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (m: typeof mockManager) => Promise<User>) => cb(mockManager),
    );

    await usersService.activateUser('u1');

    expect(mockManager.save).toHaveBeenCalledWith(
      User,
      expect.objectContaining({ status: UserStatus.ACTIVE }),
    );
  });

  it('marks the invitation as isUsed inside the same transaction', async () => {
    const user = pendingUser();
    mockUserRepo.findOneOrFail.mockResolvedValue(user);

    const invitation = { id: 'inv-1', email: 'teacher@example.com', isUsed: false };
    const mockManager = {
      save: jest.fn().mockImplementation((_entity: unknown, obj: unknown) => Promise.resolve(obj)),
      findOne: jest.fn().mockResolvedValue(invitation),
    };
    (AppDataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (m: typeof mockManager) => Promise<User>) => cb(mockManager),
    );

    await usersService.activateUser('u1');

    expect(mockManager.save).toHaveBeenCalledWith(
      InvitationToken,
      expect.objectContaining({ isUsed: true }),
    );
  });

  it('clears Redis suspension and pending keys only AFTER the transaction commits', async () => {
    const user = pendingUser();
    mockUserRepo.findOneOrFail.mockResolvedValue(user);

    const order: string[] = [];
    const mockManager = {
      save: jest.fn().mockImplementation(async () => {
        order.push('db-save');
        return { ...user, status: UserStatus.ACTIVE };
      }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    (AppDataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (m: typeof mockManager) => Promise<User>) => cb(mockManager),
    );
    (tokenService.clearUserSuspension as jest.Mock).mockImplementation(async () => {
      order.push('redis-clear');
    });

    await usersService.activateUser('u1');

    expect(order).toEqual(['db-save', 'redis-clear']);
    expect(tokenService.clearUserSuspension).toHaveBeenCalledWith('u1');
    expect(tokenService.clearUserPending).toHaveBeenCalledWith('u1');
  });

  // ── Failure path ──────────────────────────────────────────────────────────

  it('throws 409 and skips the transaction when the user is already active', async () => {
    mockUserRepo.findOneOrFail.mockResolvedValue({ ...pendingUser(), status: UserStatus.ACTIVE });

    await expect(usersService.activateUser('u1')).rejects.toMatchObject({ statusCode: 409 });
    expect(AppDataSource.transaction).not.toHaveBeenCalled();
  });

  it('does NOT clear Redis keys when the transaction rejects', async () => {
    mockUserRepo.findOneOrFail.mockResolvedValue(pendingUser());
    (AppDataSource.transaction as jest.Mock).mockRejectedValue(new Error('DB connection lost'));

    await expect(usersService.activateUser('u1')).rejects.toThrow('DB connection lost');

    expect(tokenService.clearUserSuspension).not.toHaveBeenCalled();
    expect(tokenService.clearUserPending).not.toHaveBeenCalled();
  });

  it('does NOT clear Redis keys when InvitationToken.save fails mid-transaction', async () => {
    const user = pendingUser();
    mockUserRepo.findOneOrFail.mockResolvedValue(user);

    const invitation = { id: 'inv-1', email: 'teacher@example.com', isUsed: false };
    const mockManager = {
      // First call (User.save) resolves; second call (InvitationToken.save) rejects
      save: jest.fn()
        .mockResolvedValueOnce({ ...user, status: UserStatus.ACTIVE })
        .mockRejectedValueOnce(new Error('FK violation')),
      findOne: jest.fn().mockResolvedValue(invitation),
    };
    (AppDataSource.transaction as jest.Mock).mockImplementation(
      async (cb: (m: typeof mockManager) => Promise<User>) => cb(mockManager),
    );

    await expect(usersService.activateUser('u1')).rejects.toThrow('FK violation');

    expect(tokenService.clearUserSuspension).not.toHaveBeenCalled();
    expect(tokenService.clearUserPending).not.toHaveBeenCalled();
  });
});
