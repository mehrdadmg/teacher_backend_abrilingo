import { Request, Response, NextFunction } from 'express';
import { tokenService } from '../../modules/auth/services/token.service';

export async function jwtAuthGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.access_token as string | undefined;

  if (!token) {
    res.status(401).json({
      statusCode: 401,
      message: 'Authentication required',
      error: 'Unauthorized',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const payload = tokenService.verifyAccessToken(token);

    if (await tokenService.isBlacklisted(payload.jti)) {
      tokenService.clearAuthCookies(res);
      res.status(401).json({
        statusCode: 401,
        message: 'Token has been revoked',
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Spec: instant revocation for user blocking — checked on every request
    if (await tokenService.isUserSuspended(payload.sub)) {
      tokenService.clearAuthCookies(res);
      res.status(401).json({
        statusCode: 401,
        message: 'Account has been suspended',
        error: 'Unauthorized',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.jwtPayload = payload;
    next();
  } catch {
    res.status(401).json({
      statusCode: 401,
      message: 'Invalid or expired token',
      error: 'Unauthorized',
      timestamp: new Date().toISOString(),
    });
  }
}
