import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../errors/domain.error';

const STATUS_BY_ERROR = new Map<Function, HttpStatus>([
  [NotFoundError, HttpStatus.NOT_FOUND],
  [UnauthorizedError, HttpStatus.UNAUTHORIZED],
  [ForbiddenError, HttpStatus.FORBIDDEN],
  [ValidationError, HttpStatus.UNPROCESSABLE_ENTITY],
  [ConflictError, HttpStatus.CONFLICT],
]);

/**
 * Translates domain errors into HTTP, in one place.
 *
 * The alternative — every controller mapping its own errors — is how one
 * endpoint ends up answering 200 with `{ error: … }` while its neighbour
 * answers 403, and how a client ends up parsing both.
 */
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(error: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = STATUS_BY_ERROR.get(error.constructor) ?? HttpStatus.INTERNAL_SERVER_ERROR;

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`Unmapped domain error ${error.name}: ${error.message}`);
    }

    response.status(status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error instanceof ValidationError && error.details ? { details: error.details } : {}),
      },
    });
  }
}
