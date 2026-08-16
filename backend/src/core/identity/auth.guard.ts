import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UnauthorizedError } from '../../common/errors/domain.error';
import { REQUEST_USER } from './current-user.decorator';
import { SessionService } from './session.service';

/**
 * Turns a bearer token into a current user, or refuses the request.
 *
 * Opt-IN, applied per route rather than globally with an @Public escape hatch.
 * The two get the same result until someone adds an endpoint and forgets the
 * decorator — with a global guard that endpoint is protected, with opt-in it is
 * open. Neither default is safe by itself; what makes this safe is that every
 * route lands in a review where the guard's absence is visible on the line
 * above the handler.
 *
 * Every rejection is identical: malformed header, unknown token, expired,
 * revoked, or a user disabled mid-session all produce one error.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = bearerToken(request.headers.authorization);

    if (!token) throw new UnauthorizedError('Authentication required.');

    const user = await this.sessions.resolve(token);
    if (!user) throw new UnauthorizedError('Authentication required.');

    (request as unknown as Record<string, unknown>)[REQUEST_USER] = user;
    return true;
  }
}

/** Also used by the logout handler, which needs the raw token to revoke it. */
export function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) return null;
  return value.trim() || null;
}
