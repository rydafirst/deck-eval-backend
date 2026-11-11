import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null = config.emailServer ? nodemailer.createTransport(config.emailServer) : null;

  async sendMagicLink(email: string, link: string, invited = false) {
    const subject = invited ? 'You have been invited to Deck Eval' : 'Your Deck Eval sign-in link';
    const intro = invited ? 'You have been invited to Deck Eval.' : 'Use this link to sign in to Deck Eval.';
    if (!this.transport) {
      this.logger.log(`Magic link for ${email}: ${link}`);
      return;
    }
    await this.transport.sendMail({
      from: config.emailFrom,
      to: email,
      subject,
      text: `${intro}\n\n${link}\n\nThe link expires in ${config.magicLinkMinutes} minutes.`,
      html: `<p>${intro}</p><p><a href="${link}">Sign in to Deck Eval</a></p><p>The link expires in ${config.magicLinkMinutes} minutes.</p>`,
    });
  }
}
