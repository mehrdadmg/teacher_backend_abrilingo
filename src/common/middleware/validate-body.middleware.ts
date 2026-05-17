import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction } from 'express';

function extractMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((e) =>
    e.constraints
      ? Object.values(e.constraints)
      : extractMessages(e.children ?? []),
  );
}

export function validateBody<T extends object>(DtoClass: new () => T) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const dto = plainToInstance(DtoClass, req.body);
    const errors = await validate(dto as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      res.status(400).json({
        statusCode: 400,
        message: extractMessages(errors),
        error: 'Bad Request',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.body = dto;
    next();
  };
}
