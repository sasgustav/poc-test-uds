import { Inject, Injectable } from '@nestjs/common';
import { Fatura } from '../../domain/entities/fatura';
import { FaturaNotFoundException } from '../../domain/exceptions/domain.exceptions';
import type { FaturaRepository } from '../../domain/ports/fatura.repository';
import { FATURA_REPOSITORY } from '../../domain/ports/tokens';

@Injectable()
export class BuscarFaturaUseCase {
  constructor(
    @Inject(FATURA_REPOSITORY) private readonly repo: FaturaRepository,
  ) {}

  async executar(id: string, userId: string): Promise<Fatura> {
    const fatura = await this.repo.buscarPorIdDoUsuario(id, userId);
    if (!fatura) throw new FaturaNotFoundException(id);
    return fatura;
  }
}
