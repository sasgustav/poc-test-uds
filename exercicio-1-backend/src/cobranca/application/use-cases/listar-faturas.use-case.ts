import { Inject, Injectable } from '@nestjs/common';
import { Fatura } from '../../domain/entities/fatura';
import type {
  FaturaRepository,
  Paginated,
} from '../../domain/ports/fatura.repository';
import { FATURA_REPOSITORY } from '../../domain/ports/tokens';

export interface ListarFaturasInput {
  userId: string;
  page: number;
  pageSize: number;
}

@Injectable()
export class ListarFaturasUseCase {
  constructor(
    @Inject(FATURA_REPOSITORY) private readonly repo: FaturaRepository,
  ) {}

  async executar(input: ListarFaturasInput): Promise<Paginated<Fatura>> {
    // Clamp defensivo para evitar abuso via pageSize=99999.
    const pageSize = Math.min(Math.max(input.pageSize, 1), 100);
    const page = Math.max(input.page, 1);
    return this.repo.listarPorUsuario({ userId: input.userId, page, pageSize });
  }
}
