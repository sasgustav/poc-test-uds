export interface EnviarEmailInput {
  to: string;
  subject: string;
  template: string;
  context: Record<string, unknown>;
  /** Chave de idempotência passada ao provedor (SendGrid/SES). */
  idempotencyKey: string;
}

export interface EmailSender {
  enviar(input: EnviarEmailInput): Promise<void>;
}
