export enum FaturaStatus {
  PENDENTE = 'pendente',
  PAGA = 'paga',
  VENCIDA = 'vencida',
  CANCELADA = 'cancelada',
}

/**
 * Máquina de estados. Transições não listadas são proibidas.
 * Mantida no domínio (não no banco) para permitir invariantes claras e testáveis.
 */
export const FATURA_TRANSICOES_PERMITIDAS: Readonly<
  Record<FaturaStatus, readonly FaturaStatus[]>
> = Object.freeze({
  [FaturaStatus.PENDENTE]: [FaturaStatus.PAGA, FaturaStatus.VENCIDA, FaturaStatus.CANCELADA],
  [FaturaStatus.VENCIDA]: [FaturaStatus.PAGA, FaturaStatus.CANCELADA],
  [FaturaStatus.PAGA]: [],
  [FaturaStatus.CANCELADA]: [],
});
