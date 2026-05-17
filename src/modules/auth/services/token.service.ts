import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { redisClient } from '../../../config/redis.config';
import { config } from '../../../config/env.config';
import { JwtPayload, OAuthStatePayload } from '../types/jwt-payload.type';

const BLACKLIST_PREFIX = 'blacklist:';

// Converts strings like '15m', '7d', '1h' to seconds
function toSeconds(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return parseInt(expiresIn, 10);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(match[1], 10) * multipliers[match[2]];
}

const BASE_COOKIE = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

class TokenService {
  generateAccessToken(userId: string, role: string): { token: string; jti: string } {
    const jti = uuidv4();
    const token = jwt.sign(
      { sub: userId, role, jti },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'] },
    );
    return { token, jti };
  }

  generateRefreshToken(userId: string, role: string): { token: string; jti: string } {
    const jti = uuidv4();
    const token = jwt.sign(
      { sub: userId, role, jti },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] },
    );
    return { token, jti };
  }

  // Signs the OAuth state as a short-lived JWT so it carries an invitation token
  // and is tamper-proof (doubles as CSRF protection).
  generateOAuthState(invitationToken?: string): string {
    const payload: OAuthStatePayload = { nonce: uuidv4(), invitationToken };
    return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: '10m' });
  }

  verifyOAuthState(state: string): OAuthStatePayload {
    return jwt.verify(state, config.jwt.accessSecret) as OAuthStatePayload;
  }

  verifyAccessToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
  }

  verifyRefreshToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
  }

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie('access_token', accessToken, {
      ...BASE_COOKIE,
      maxAge: toSeconds(config.jwt.accessExpiresIn) * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      ...BASE_COOKIE,
      maxAge: toSeconds(config.jwt.refreshExpiresIn) * 1000,
    });
  }

  clearAuthCookies(res: Response): void {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds > 0) {
      await redisClient.setex(`${BLACKLIST_PREFIX}${jti}`, ttlSeconds, '1');
    }
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    const result = await redisClient.get(`${BLACKLIST_PREFIX}${jti}`);
    return result !== null;
  }

  async markUserSuspended(userId: string): Promise<void> {
    await redisClient.set(`suspended:${userId}`, '1');
  }

  async clearUserSuspension(userId: string): Promise<void> {
    await redisClient.del(`suspended:${userId}`);
  }

  async isUserSuspended(userId: string): Promise<boolean> {
    const result = await redisClient.get(`suspended:${userId}`);
    return result !== null;
  }

  async clearUserPending(userId: string): Promise<void> {
    await redisClient.del(`pending:${userId}`);
  }
}

export const tokenService = new TokenService();
