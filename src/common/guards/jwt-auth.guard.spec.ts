import { Request, Response, NextFunction } from 'express';
import { jwtAuthGuard } from './jwt-auth.guard';
import { tokenService } from '../../modules/auth/services/token.service';

jest.mock('../../modules/auth/services/token.service', () => ({
  tokenService: {
    verifyAccessToken: jest.fn(),
    isBlacklisted: jest.fn(),
    isUserSuspended: jest.fn(),
    clearAuthCookies: jest.fn(),
  },
}));

function makeReq(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

function makeRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('jwtAuthGuard', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    (tokenService.isBlacklisted as jest.Mock).mockResolvedValue(false);
    (tokenService.isUserSuspended as jest.Mock).mockResolvedValue(false);
  });

  it('returns 401 when no access_token cookie is present', async () => {
    const req = makeReq({});
    const res = makeRes();

    await jwtAuthGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Authentication required', error: 'Unauthorized' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 and clears cookies when the jti is in the Redis blacklist', async () => {
    const payload = { sub: 'u1', jti: 'jti-blacklisted', role: 'TEACHER', exp: 9_999_999_999, iat: 0 };
    (tokenService.verifyAccessToken as jest.Mock).mockReturnValue(payload);
    (tokenService.isBlacklisted as jest.Mock).mockResolvedValue(true);

    const req = makeReq({ access_token: 'revoked.token.value' });
    const res = makeRes();

    await jwtAuthGuard(req, res, next);

    expect(tokenService.clearAuthCookies).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Token has been revoked' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 and clears cookies when the user has a suspended:{id} key in Redis', async () => {
    const payload = { sub: 'u1', jti: 'jti-1', role: 'TEACHER', exp: 9_999_999_999, iat: 0 };
    (tokenService.verifyAccessToken as jest.Mock).mockReturnValue(payload);
    (tokenService.isBlacklisted as jest.Mock).mockResolvedValue(false);
    (tokenService.isUserSuspended as jest.Mock).mockResolvedValue(true);

    const req = makeReq({ access_token: 'suspended.user.token' });
    const res = makeRes();

    await jwtAuthGuard(req, res, next);

    expect(tokenService.clearAuthCookies).toHaveBeenCalledWith(res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Account has been suspended' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches jwtPayload and calls next() for a valid, non-blacklisted, non-suspended token', async () => {
    const payload = { sub: 'u1', jti: 'jti-valid', role: 'TEACHER', exp: 9_999_999_999, iat: 0 };
    (tokenService.verifyAccessToken as jest.Mock).mockReturnValue(payload);

    const req = makeReq({ access_token: 'valid.token.here' });
    const res = makeRes();

    await jwtAuthGuard(req, res, next);

    expect((req as any).jwtPayload).toEqual(payload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(tokenService.clearAuthCookies).not.toHaveBeenCalled();
  });

  it('returns 401 when the token signature verification throws', async () => {
    (tokenService.verifyAccessToken as jest.Mock).mockImplementation(() => {
      throw new Error('invalid signature');
    });

    const req = makeReq({ access_token: 'tampered.token.here' });
    const res = makeRes();

    await jwtAuthGuard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid or expired token' }),
    );
    expect(next).not.toHaveBeenCalled();
  });
});
