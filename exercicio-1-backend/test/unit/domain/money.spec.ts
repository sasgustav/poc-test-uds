import fc from 'fast-check';
import { InvalidMoneyException } from '../../../src/cobranca/domain/exceptions/domain.exceptions';
import { Money } from '../../../src/cobranca/domain/value-objects/money';

describe('Money VO', () => {
  it('fromDecimal arredonda corretamente (evita binary float)', () => {
    expect(Money.fromDecimal(150.5).cents).toBe(15_050);
    expect(Money.fromDecimal(0.1).cents).toBe(10);
    expect(Money.fromDecimal(0.2).cents).toBe(20);
  });

  it.each([-1, -0.01, Number.NaN, Infinity])('rejeita %p', (v) => {
    expect(() => Money.fromDecimal(v)).toThrow(InvalidMoneyException);
  });

  it('fromCents exige inteiro', () => {
    expect(() => Money.fromCents(100.5)).toThrow(InvalidMoneyException);
  });

  describe('fromDecimal — string input', () => {
    it('aceita string "150.50"', () => {
      expect(Money.fromDecimal('150.50').cents).toBe(15_050);
    });

    it('aceita string sem centavos "100"', () => {
      expect(Money.fromDecimal('100').cents).toBe(10_000);
    });

    it('aceita string com uma casa decimal "99.9"', () => {
      expect(Money.fromDecimal('99.9').cents).toBe(9990);
    });

    it('trunca para 2 casas decimais — "1.005" → 100 (não 101)', () => {
      expect(Money.fromDecimal('1.005').cents).toBe(100);
    });

    it('rejeita string não numérica', () => {
      expect(() => Money.fromDecimal('abc')).toThrow(InvalidMoneyException);
    });
  });

  describe('currency validation', () => {
    it('aceita BRL, USD, EUR', () => {
      expect(Money.fromCents(100, 'BRL').currency).toBe('BRL');
      expect(Money.fromCents(100, 'USD').currency).toBe('USD');
      expect(Money.fromCents(100, 'EUR').currency).toBe('EUR');
    });

    it('rejeita moedas não suportadas', () => {
      expect(() => Money.fromCents(100, 'GBP')).toThrow(InvalidMoneyException);
    });
  });

  describe('equals()', () => {
    it('retorna true para mesmo cents + currency', () => {
      const a = Money.fromCents(500, 'BRL');
      const b = Money.fromCents(500, 'BRL');
      expect(a.equals(b)).toBe(true);
    });

    it('retorna false para moedas diferentes', () => {
      const a = Money.fromCents(500, 'BRL');
      const b = Money.fromCents(500, 'USD');
      expect(a.equals(b)).toBe(false);
    });

    it('retorna false para valores diferentes', () => {
      const a = Money.fromCents(500, 'BRL');
      const b = Money.fromCents(501, 'BRL');
      expect(a.equals(b)).toBe(false);
    });
  });

  it('toString formata com moeda e 2 casas', () => {
    expect(Money.fromCents(15_050).toString()).toBe('BRL 150.50');
  });

  it('rejeita valor que excede limite de precisão', () => {
    expect(() => Money.fromCents(1_000_000_000_000)).toThrow(InvalidMoneyException);
  });

  it('property: round-trip cents→decimal→cents preserva valor', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99_999_999_999 }), (cents) => {
        const m = Money.fromCents(cents);
        const back = Money.fromDecimal(m.toDecimal());
        expect(back.cents).toBe(cents);
      }),
    );
  });
});
