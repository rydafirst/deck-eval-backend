import { Body, Controller, Get, HttpCode, Post, Query, Res } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { z } from 'zod';
import type { SessionUser } from '../shared';
import { config } from '../config';
import { CurrentUser, Public } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
const magicSchema = z.object({ email: z.email() });
const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email(),
  password: z.string().min(8, 'Use at least 8 characters').max(200),
});

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  path: '/',
  maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.loginWithPassword(body.email, body.password);
    res.cookie(config.cookieName, this.auth.issueToken(user), cookieOptions);
    await this.audit.log(user.id, 'login', 'User', user.id, { method: 'password' });
    return user;
  }

  @Public()
  @Get('signup')
  signupStatus() {
    return { open: config.allowSignup };
  }

  @Public()
  @Post('signup')
  @HttpCode(201)
  async signup(@Body(new ZodPipe(signupSchema)) body: z.infer<typeof signupSchema>, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.signUp(body.name, body.email, body.password);
    res.cookie(config.cookieName, this.auth.issueToken(user), cookieOptions);
    await this.audit.log(user.id, 'signup', 'User', user.id);
    return user;
  }

  @Public()
  @Post('magic-link')
  @HttpCode(202)
  async magicLink(@Body(new ZodPipe(magicSchema)) body: z.infer<typeof magicSchema>) {
    await this.auth.sendMagicLink(body.email);
    return { sent: true };
  }

  @Public()
  @Get('magic')
  async consume(@Query('token') token: string, @Res() res: Response) {
    try {
      const user = await this.auth.consumeMagicLink(token ?? '');
      res.cookie(config.cookieName, this.auth.issueToken(user), cookieOptions);
      await this.audit.log(user.id, 'login', 'User', user.id, { method: 'magic_link' });
      res.redirect(`${config.webUrl}/`);
    } catch {
      res.redirect(`${config.webUrl}/login?error=link_expired`);
    }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(config.cookieName, { path: '/' });
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser) {
    return user;
  }
}
