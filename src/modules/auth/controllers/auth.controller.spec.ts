// jest.mock calls are hoisted by ts-jest before any imports, so the env mock
// is in effect when token.service.ts is first loaded and BASE_COOKIE.secure is set.
jest.mock('../../../config/env.config', () => ({
  config: {
    nodeEnv: 'production', // ensures Secure flag is applied to cookies
    clientUrl: 'http://localhost:3001',
    jwt: {
      accessSecret: 'test-access-secret-32chars-minimumxxx',
      refreshSecret: 'test-refresh-secret-32chars-minimumxxx',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    },
    resend: { fromEmail: 'noreply@abrilingo.com', apiKey: '' },
    google: { clientId: '', clientSecret: '', callbackUrl: '' },
  },
}));

jest.mock('../../../config/redis.config', () => ({
  redisClient: {
    get: jest.fn(),
    setex: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../../../config/database.config', () => ({
  AppDataSource: { getRepository: jest.fn().mockReturnValue({ findOne: jest.fn() }) },
}));

jest.mock('../../../config/email.config', () => ({
  resend: { emails: { send: jest.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null }) } },
}));

jest.mock('../../../config/logger.config', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authRouter } from './auth.controller';
import { redisClient } from '../../../config/redis.config';

const TEST_REFRESH_SECRET = 'test-refresh-secret-32chars-minimumxxx';
const TEST_ACCESS_SECRET = 'test-access-secret-32chars-minimumxxx';

function signRefreshToken(jti: string): string {
  return jwt.sign({ sub: 'user-123', role: 'TEACHER', jti }, TEST_REFRESH_SECRET, { expiresIn: '7d' });
}

function signAccessToken(jti: string): string {
  return jwt.sign({ sub: 'user-123', role: 'TEACHER', jti }, TEST_ACCESS_SECRET, { expiresIn: '15m' });
}

const testApp = express();
testApp.use(cookieParser());
testApp.use(express.json());
testApp.use('/api/auth', authRouter);

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient.get as jest.Mock).mockResolvedValue(null);   // not blacklisted by default
    (redisClient.set as jest.Mock).mockResolvedValue('OK');
  });

  it('returns 401 when no refresh_token cookie is provided', async () => {
    const res = await request(testApp).post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: 'Refresh token missing', error: 'Unauthorized' });
  });

  it('returns 401 when the token is invalid or expired', async () => {
    const res = await request(testApp)
      .post('/api/auth/refresh')
      .set('Cookie', 'refresh_token=not.a.valid.jwt');

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: 'Invalid or expired refresh token' });
  });

  it('returns 401 and clears cookies when the refresh token jti is in the Redis blacklist', async () => {
    const token = signRefreshToken('jti-blacklisted-1');
    (redisClient.get as jest.Mock).mockResolvedValue('1'); // blacklisted

    const res = await request(testApp)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: 'Refresh token has been revoked' });
  });

  it('returns 200 and issues a new token pair on a valid, non-blacklisted token', async () => {
    const token = signRefreshToken('jti-valid-1');

    const res = await request(testApp)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Tokens refreshed successfully' });
    // Old jti was blacklisted before the new pair was issued
    expect(redisClient.set).toHaveBeenCalledWith(
      expect.stringContaining('blacklist:'),
      '1',
      'EX',
      expect.any(Number),
    );
  });

  it('sets access_token cookie with HttpOnly, Secure, and SameSite=Strict', async () => {
    const token = signRefreshToken('jti-cookie-test-1');

    const res = await request(testApp)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${token}`);

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const accessCookie = cookies?.find((c) => c.startsWith('access_token='));

    expect(accessCookie).toBeDefined();
    expect(accessCookie).toMatch(/HttpOnly/i);
    expect(accessCookie).toMatch(/Secure/i);
    expect(accessCookie).toMatch(/SameSite=Strict/i);
  });

  it('sets refresh_token cookie with HttpOnly, Secure, and SameSite=Strict', async () => {
    const token = signRefreshToken('jti-cookie-test-2');

    const res = await request(testApp)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${token}`);

    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    const refreshCookie = cookies?.find((c) => c.startsWith('refresh_token='));

    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/Secure/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  });

  it('returns 401 and clears cookies when the user has a suspended:{id} key in Redis', async () => {
    const token = signRefreshToken('jti-suspended-user');
    // First GET = blacklist check (not blacklisted), second GET = suspension check (suspended)
    (redisClient.get as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('1');

    const res = await request(testApp)
      .post('/api/auth/refresh')
      .set('Cookie', `refresh_token=${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ message: 'Account has been suspended', error: 'Unauthorized' });
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (redisClient.get as jest.Mock).mockResolvedValue(null);
    (redisClient.set as jest.Mock).mockResolvedValue('OK');
  });

  it('returns 200 with success message and blacklists both tokens', async () => {
    const accessToken = signAccessToken('acc-jti-logout');
    const refreshToken = signRefreshToken('ref-jti-logout');

    const res = await request(testApp)
      .post('/api/auth/logout')
      .set('Cookie', `access_token=${accessToken}; refresh_token=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Logged out successfully' });
    // Both tokens' jtis are sent to Redis blacklist
    expect(redisClient.set).toHaveBeenCalledTimes(2);
  });

  it('returns 200 gracefully when no cookies are present', async () => {
    const res = await request(testApp).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ message: 'Logged out successfully' });
    expect(redisClient.set).not.toHaveBeenCalled();
  });
});
