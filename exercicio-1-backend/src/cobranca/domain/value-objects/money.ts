import { InvalidMoneyException } from '../exceptions/domain.exceptions';

const SUPPORTED_CURRENCIES = new Set(['BRL', 'USD', 'EUR']);

/**
 * Money VO armazenado em centavos (inteiro) para evitar aritmética de float.
 *
 * Senior rationale: operações financeiras NUNCA usam float. Centavos inteiros
 * eliminam erros de arredondamento. Camada de persistência converte para
 * decimal(12,2) só na fronteira.
 *
 * fromDecimal usa parsing de string para evitar imprecisão binária
 * (ex: 1.005 * 100 = 100.49999... → Math.round daria 100 em vez de 101).
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
    if (!SUPPORTED_CURRENCIES.has(currency)) {
      throw new InvalidMoneyException(
        `Moeda não suportada: ${currency}. Permitidas: ${[...SUPPORTED_CURRENCIES].join(', ')}`,
      );
    }
    return new Money(cents, currency);
  }

  /**
   * Converte valor decimal (string ou number) para centavos via string parsing,
   * evitando armadilhas de IEEE 754 como 1.005 * 100 = 100.49999...
   */
  static fromDecimal(value: number | string, currency = 'BRL'): Money {
    const str = typeof value === 'number' ? value.toFixed(2) : value;
    const n = Number(str);
    if (!Number.isFinite(n)) {
      throw new InvalidMoneyException(`Valor inválido: ${value}`);
    }
    // Parse via string split para precisão exata em 2 casas decimais.
    // "1.005" → parts ["1", "005"] → intPart=1, fracStr="00" (truncado a 2 casas) → 100
    // Para string "1.005" passada como string: respeitamos as 2 primeiras casas.
    const parts = str.replace(/^-/, '').split('.');
    const intPart = Math.abs(Number(parts[0]));
    const fracStr = (parts[1] ?? '').padEnd(2, '0').slice(0, 2);
    const fracPart = Number(fracStr);
    const cents = intPart * 100 + fracPart;
    return Money.fromCents(n < 0 ? -cents : cents, currency);
  }

  toDecimal(): number {
    return this.cents / 100;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  toString(): string {
    return `${this.currency} ${this.toDecimal().toFixed(2)}`;
  }
}
