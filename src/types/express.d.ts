import type { JwtPayload } from '../modules/auth/types/jwt-payload.type';

declare global {
  namespace Express {
    interface Request {
      jwtPayload?: JwtPayload;
    }
  }
}
