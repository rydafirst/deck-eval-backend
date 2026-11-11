import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import type { SessionUser } from '../shared';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';

interface SessionPayload {
  sub: string;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async loginWithPassword(email: string, password: string): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    const ok = user?.active && user.passwordHash && (await bcrypt.compare(password, user.passwordHash));
    if (!ok || !user) throw new UnauthorizedException('Email or password is incorrect');
    return this.toSession(user);
  }

  async signUp(name: string, email: string, password: string): Promise<SessionUser> {
    if (!config.allowSignup) throw new ForbiddenException('Sign-up is closed. Ask an admin for an invite.');
    const normalised = email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalised } });
    if (existing) throw new ConflictException('An account with this email already exists. Sign in instead.');
    const user = await this.prisma.user.create({
      data: { email: normalised, name, role: 'RATER', passwordHash: await this.hashPassword(password) },
    });
    return this.toSession(user);
  }

  async sendMagicLink(email: string, invited = false): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.active) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.magicLinkToken.create({
      data: {
        email: user.email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + config.magicLinkMinutes * 60_000),
      },
    });
    await this.mail.sendMagicLink(user.email, `${config.webUrl}/api/auth/magic?token=${token}`, invited);
  }

  async consumeMagicLink(token: string): Promise<SessionUser> {
    const record = await this.prisma.magicLinkToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('This sign-in link has expired');
    }
    await this.prisma.magicLinkToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    const user = await this.prisma.user.findUnique({ where: { email: record.email } });
    if (!user?.active) throw new UnauthorizedException('Account is not active');
    return this.toSession(user);
  }

  issueToken(user: SessionUser): string {
    return this.jwt.sign({ sub: user.id } satisfies SessionPayload, { expiresIn: `${config.sessionDays}d` });
  }

  async userFromToken(token: string): Promise<SessionUser | null> {
    try {
      const { sub } = this.jwt.verify<SessionPayload>(token);
      const user = await this.prisma.user.findUnique({ where: { id: sub } });
      return user?.active ? this.toSession(user) : null;
    } catch {
      return null;
    }
  }

  hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  private toSession(user: { id: string; email: string; name: string | null; role: SessionUser['role'] }): SessionUser {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }
}
