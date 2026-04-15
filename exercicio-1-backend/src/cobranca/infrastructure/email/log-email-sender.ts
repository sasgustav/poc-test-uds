import { Injectable, Logger } from '@nestjs/common';
import type { EmailSender, EnviarEmailInput } from '../../domain/ports/email-sender.port';

/**
 * Adapter de e-mail para dev/homolog. Em produção, substituir por SES/SendGrid
 * passando `idempotencyKey` ao provedor (ambos suportam nativamente).
 */
@Injectable()
export class LogEmailSender implements EmailSender {
  private readonly logger = new Logger(LogEmailSender.name);

  enviar(input: EnviarEmailInput): Promise<void> {
    this.logger.log({
      msg: 'email.sent',
      to: redactEmail(input.to),
      template: input.template,
      idempotencyKey: input.idempotencyKey,
    });
    return Promise.resolve();
  }
}

function redactEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
}
