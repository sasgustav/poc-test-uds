import { InvalidEmailException } from '../../../src/cobranca/domain/exceptions/domain.exceptions';
import { Email } from '../../../src/cobranca/domain/value-objects/email';

describe('Email VO', () => {
  it('normaliza para lowercase e trim', () => {
    const email = Email.of('  Maria@Example.COM  ');
    expect(email.value).toBe('maria@example.com');
  });

  it('rejeita email sem @', () => {
    expect(() => Email.of('invalido')).toThrow(InvalidEmailException);
  });

  it('rejeita email sem domínio', () => {
    expect(() => Email.of('user@')).toThrow(InvalidEmailException);
  });

  it('rejeita email vazio', () => {
    expect(() => Email.of('')).toThrow(InvalidEmailException);
  });

  it('rejeita email com mais de 255 caracteres', () => {
    const longLocal = 'a'.repeat(250);
    expect(() => Email.of(`${longLocal}@example.com`)).toThrow(InvalidEmailException);
  });

  describe('equals()', () => {
    it('retorna true para emails equivalentes', () => {
      const a = Email.of('test@example.com');
      const b = Email.of('TEST@Example.COM');
      expect(a.equals(b)).toBe(true);
    });

    it('retorna false para emails diferentes', () => {
      const a = Email.of('a@example.com');
      const b = Email.of('b@example.com');
      expect(a.equals(b)).toBe(false);
    });
  });

  it('toString retorna o valor normalizado', () => {
    const email = Email.of('Test@Example.com');
    expect(email.toString()).toBe('test@example.com');
  });
});
