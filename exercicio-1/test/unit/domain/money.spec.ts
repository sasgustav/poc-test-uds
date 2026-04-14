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
