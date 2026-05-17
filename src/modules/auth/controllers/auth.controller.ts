import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Profile } from 'passport-google-oauth20';
import { authService } from '../services/auth.service';
import { tokenService } from '../services/token.service';
import { UserStatus } from '../../users/entities/user.entity';
import { config } from '../../../config/env.config';
import { logger } from '../../../config/logger.config';
import { InvitationException } from '../../../common/errors/invitation.errors';

export const authRouter = Router();

function apiError(res: Response, statusCode: number, message: string, error: string): Response {
  return res.status(statusCode).json({
    statusCode,
    message,
    error,
    timestamp: new Date().toISOString(),
  });
}

/**
 * @openapi
 * /api/auth/google:
 *   get:
 *     tags: [Auth]
 *     summary: Initiate Google OAuth2 login
 *     description: |
 *       Redirects to Google's OAuth consent screen.
 *       Pass `?invitationToken=xxx` for new-user registration — the token is encoded
 *       in a signed JWT `state` parameter so it survives the round-trip tamper-proof.
 *     parameters:
 *       - in: query
 *         name: invitationToken
 *         required: false
 *         schema:
 *           type: string
 *         description: Signed invitation token from the invite email link.
 *     responses:
 *       '302':
 *         description: Redirect to Google OAuth consent screen
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *               example: 'https://accounts.google.com/o/oauth2/v2/auth?...'
 */
// ─── Step 1: Redirect to Google ───────────────────────────────────────────────
// Optionally accepts ?invitationToken=xxx — encoded into a signed JWT state so
// it survives the OAuth round-trip and can't be tampered with.
authRouter.get('/google', (req: Request, res: Response, next: NextFunction) => {
  const invitationToken = req.query.invitationToken as string | undefined;
  const state = tokenService.generateOAuthState(invitationToken);
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    state,
  })(req, res, next);
});

/**
 * @openapi
 * /api/auth/google/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Google OAuth2 callback
 *     description: |
 *       Google redirects here after user consent. Validates the OAuth `state` JWT,
 *       finds or creates the user (with invitation validation for new users),
 *       sets `access_token` and `refresh_token` HttpOnly cookies, then redirects.
 *
 *       Redirect destinations:
 *       - `/dashboard` — active user, cookies set
 *       - `/pending-approval` — new user awaiting admin approval
 *       - `/auth/error?code=<code>` — error codes: `google-auth-failed`,
 *         `invitation-required`, `invitation-invalid`, `invitation-used`,
 *         `invitation-expired`, `email-mismatch`, `account-suspended`,
 *         `invalid-state`, `auth-error`
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Google.
 *       - in: query
 *         name: state
 *         required: false
 *         schema:
 *           type: string
 *         description: Signed JWT state carrying the invitation token.
 *     responses:
 *       '302':
 *         description: Redirect to frontend — destination depends on user status
 *         headers:
 *           Location:
 *             schema:
 *               type: string
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: 'access_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Path=/'
 */
// ─── Step 2: Google callback ───────────────────────────────────────────────────
authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${config.clientUrl}/auth/error?code=google-auth-failed`,
  }),
  async (req: Request, res: Response) => {
    try {
      const googleProfile = req.user as Profile;

      // Recover invitation token from the verified OAuth state JWT
      let invitationToken: string | undefined;
      const rawState = req.query.state as string | undefined;
      if (rawState) {
        try {
          const statePayload = tokenService.verifyOAuthState(rawState);
          invitationToken = statePayload.invitationToken;
        } catch {
          return res.redirect(`${config.clientUrl}/auth/error?code=invalid-state`);
        }
      }

      const user = await authService.findOrCreateFromGoogle(googleProfile, invitationToken);

      if (user.status === UserStatus.PENDING_APPROVAL) {
        return res.redirect(`${config.clientUrl}/pending-approval`);
      }
      if (user.status === UserStatus.SUSPENDED) {
        return res.redirect(`${config.clientUrl}/auth/error?code=account-suspended`);
      }

      const roleName = user.role?.name ?? '';
      const { token: accessToken } = tokenService.generateAccessToken(user.id, roleName);
      const { token: refreshToken } = tokenService.generateRefreshToken(user.id, roleName);
      tokenService.setAuthCookies(res, accessToken, refreshToken);

      return res.redirect(`${config.clientUrl}/dashboard`);
    } catch (err: unknown) {
      if (err instanceof InvitationException) {
        return res.redirect(`${config.clientUrl}/auth/error?code=${INVITATION_CODE_MAP[err.code] ?? 'auth-error'}`);
      }
      logger.error({ message: 'Unexpected error in OAuth callback', error: err });
      return res.redirect(`${config.clientUrl}/auth/error?code=auth-error`);
    }
  },
);

const INVITATION_CODE_MAP: Record<string, string> = {
  INVITATION_REQUIRED: 'invitation-required',
  INVITATION_INVALID: 'invitation-invalid',
  INVITATION_USED: 'invitation-used',
  INVITATION_EXPIRED: 'invitation-expired',
  INVITATION_EMAIL_MISMATCH: 'email-mismatch',
};

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the token pair
 *     description: |
 *       Issues a fresh access token + refresh token pair. The old refresh token's
 *       `jti` is blacklisted in Redis immediately — reusing a rotated token returns 401.
 *       Requires the `refresh_token` HttpOnly cookie (not the `access_token` cookie).
 *       New tokens are delivered in `Set-Cookie` response headers.
 *     responses:
 *       '200':
 *         description: Tokens rotated successfully
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: 'access_token=eyJ...; HttpOnly; Secure; SameSite=Strict'
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: Tokens refreshed successfully
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
// ─── Refresh Token Rotation ───────────────────────────────────────────────────
// Issues a fresh access + refresh token pair. The old refresh token's jti is
// blacklisted in Redis so it can never be reused.
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refresh_token as string | undefined;
  if (!refreshToken) {
    return apiError(res, 401, 'Refresh token missing', 'Unauthorized');
  }

  try {
    const payload = tokenService.verifyRefreshToken(refreshToken);

    if (await tokenService.isBlacklisted(payload.jti)) {
      tokenService.clearAuthCookies(res);
      return apiError(res, 401, 'Refresh token has been revoked', 'Unauthorized');
    }

    // Invalidate the consumed refresh token before issuing new ones
    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    await tokenService.blacklistToken(payload.jti, ttl);

    const { token: newAccessToken } = tokenService.generateAccessToken(payload.sub, payload.role);
    const { token: newRefreshToken } = tokenService.generateRefreshToken(payload.sub, payload.role);
    tokenService.setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.status(200).json({ message: 'Tokens refreshed successfully' });
  } catch {
    tokenService.clearAuthCookies(res);
    return apiError(res, 401, 'Invalid or expired refresh token', 'Unauthorized');
  }
});

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out and revoke both tokens
 *     description: |
 *       Blacklists both the access token and the refresh token in Redis,
 *       then clears the HttpOnly cookies. Tokens are immediately unusable
 *       even if they have not reached their JWT expiry.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: Logged out successfully
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
// ─── Logout ──────────────────────────────────────────────────────────────────
// Blacklists both tokens so they can't be used even before expiry.
authRouter.post('/logout', async (req: Request, res: Response) => {
  const accessToken = req.cookies?.access_token as string | undefined;
  const refreshToken = req.cookies?.refresh_token as string | undefined;
  await authService.logout(accessToken, refreshToken, res);
  return res.status(200).json({ message: 'Logged out successfully' });
});
