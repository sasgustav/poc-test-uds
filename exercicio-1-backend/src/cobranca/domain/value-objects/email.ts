import { InvalidEmailException } from '../exceptions/domain.exceptions';

// RFC 5322-ish pragmática (mesma do class-validator). Validação "de verdade"
// é via double opt-in, não regex — esta só pega erros grosseiros.
// eslint-disable-next-line sonarjs/slow-regex -- bounded to ≤255 chars; real validation is double opt-in
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static of(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();
    // Verifica comprimento antes do regex para defense-in-depth (evita regex em string longa)
    if (trimmed.length > 255) {
      throw new InvalidEmailException(`Email excede 255 caracteres`);
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      throw new InvalidEmailException(`Email inválido: ${raw}`);
    }
    return new Email(trimmed);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
