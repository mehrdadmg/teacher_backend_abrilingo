import { Request, Response, NextFunction } from 'express';
import { RoleName } from '../../modules/roles/entities/role.entity';

export function requireRoles(...roles: RoleName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.jwtPayload?.role as RoleName | undefined;

    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({
        statusCode: 403,
        message: 'Insufficient permissions',
        error: 'Forbidden',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
