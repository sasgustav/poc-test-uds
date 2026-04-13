import { FaturaStatus } from '../enums/fatura-status.enum';
import { LembreteStatus } from '../enums/lembrete-status.enum';
import { LembreteTipo } from '../enums/lembrete-tipo.enum';

export class LembreteResponseDto {
  id: string;
  dataEnvio: Date;
  tipo: LembreteTipo;
  status: LembreteStatus;
}

export class FaturaResponseDto {
  id: string;
  userId: string;
  nomeDevedor: string;
  emailDevedor: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  status: FaturaStatus;
  lembretes: LembreteResponseDto[];
  createdAt: Date;
}
