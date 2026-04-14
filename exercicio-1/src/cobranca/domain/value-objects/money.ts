import { InvalidMoneyException } from '../exceptions/domain.exceptions';

/**
 * Money VO armazenado em centavos (inteiro) para evitar aritmética de float.
 *
 * Senior rationale: operações financeiras NUNCA usam float. Centavos inteiros
 * eliminam erros de arredondamento. Camada de persistência converte para
 * decimal(12,2) só na fronteira.
 */
export class Money {
  private constructor(readonly cents: number, readonly currency: string) {}

  static fromCents(cents: number, currency = 'BRL'): Money {
    if (!Number.isInteger(cents)) {
      throw new InvalidMoneyException(`cents deve ser inteiro, recebeu ${cents}`);
    }
    if (cents < 0) {
      throw new InvalidMoneyException(`Valor não pode ser negativo`);
    }
    if (cents > 999_999_999_999) {
      throw new InvalidMoneyException(`Valor excede precisão suportada (decimal 12,2)`);
    }
    return new Money(cents, currency);
  }

  static fromDecimal(value: number | string, currency = 'BRL'): Money {
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(n)) {
      throw new InvalidMoneyException(`Valor inválido: ${value}`);
    }
    // evita 150.5 → 15049 por binary float
    const cents = Math.round(n * 100);
    return Money.fromCents(cents, currency);
  }

  toDecimal(): number {
    return this.cents / 100;
  }

  toString(): string {
    return `${this.currency} ${this.toDecimal().toFixed(2)}`;
  }
}
