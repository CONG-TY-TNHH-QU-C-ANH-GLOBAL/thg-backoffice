import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe';
import { AuthenticationService } from './authentication.service';
import { AuthGuard, bearerToken } from './auth.guard';
import { LoginInput, loginSchema } from './auth.dto';
import { CurrentUser } from './current-user.decorator';
import type { SessionUser } from './session.service';

/**
 * Three endpoints, which is all identity needs.
 *
 * There is deliberately no user CRUD here: creating users over HTTP requires
 * deciding who is allowed to, and authorization is a later phase. Until then
 * the bootstrap CLI is the only way to create one — an endpoint that skipped
 * the question would be the security hole this phase exists to avoid.
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthenticationService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: LoginInput) {
    const { session, user } = await this.auth.login(body.subject, body.password);

    return {
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      user,
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() request: Request): Promise<void> {
    const token = bearerToken(request.headers.authorization);
    // The guard already proved this is present and valid.
    if (token) await this.auth.logout(token);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: SessionUser): SessionUser {
    return user;
  }
}
