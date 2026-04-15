import { Inject, Injectable } from '@nestjs/common';
import { Fatura } from '../../domain/entities/fatura';
import { FaturaStatus } from '../../domain/enums/fatura-status.enum';
import { FaturaNotFoundException } from '../../domain/exceptions/domain.exceptions';
import type { Clock } from '../../domain/ports/clock.port';
import type { FaturaRepository } from '../../domain/ports/fatura.repository';
import { CLOCK, FATURA_REPOSITORY } from '../../domain/ports/tokens';

@Injectable()
export class AtualizarStatusFaturaUseCase {
  constructor(
    @Inject(FATURA_REPOSITORY) private readonly repo: FaturaRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async executar(id: string, userId: string, novoStatus: FaturaStatus): Promise<Fatura> {
    const fatura = await this.repo.buscarPorIdDoUsuario(id, userId);
    if (!fatura) throw new FaturaNotFoundException(id);
    fatura.mudarStatus(novoStatus, this.clock.now());
    await this.repo.salvar(fatura);
    return fatura;
  }
}
