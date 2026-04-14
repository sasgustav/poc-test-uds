import { ApiProperty } from '@nestjs/swagger';
import { Fatura } from '../../../domain/entities/fatura';
import { FaturaStatus } from '../../../domain/enums/fatura-status.enum';
import { LembreteStatus } from '../../../domain/enums/lembrete-status.enum';
import { LembreteTipo } from '../../../domain/enums/lembrete-tipo.enum';

export class LembreteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: LembreteTipo }) tipo!: LembreteTipo;
  @ApiProperty({ enum: LembreteStatus }) status!: LembreteStatus;
  @ApiProperty({ type: String, format: 'date-time' }) dataEnvio!: string;
  @ApiProperty() tentativas!: number;
  @ApiProperty({ required: false, nullable: true, type: String, format: 'date-time' })
  proximaTentativa!: string | null;
  @ApiProperty({ required: false, nullable: true }) erro!: string | null;
}

export class FaturaResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() nomeDevedor!: string;
  @ApiProperty() emailDevedor!: string;
  @ApiProperty() descricao!: string;
  @ApiProperty({ description: 'Valor decimal em BRL.' }) valor!: number;
  @ApiProperty({ description: 'Valor em centavos (fonte de verdade).' }) valorCents!: number;
  @ApiProperty({ example: '2026-05-10' }) dataVencimento!: string;
  @ApiProperty({ example: 'America/Sao_Paulo' }) timezone!: string;
  @ApiProperty({ enum: FaturaStatus }) status!: FaturaStatus;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ type: [LembreteResponseDto] }) lembretes!: LembreteResponseDto[];

  static fromDomain(f: Fatura): FaturaResponseDto {
    return {
      id: f.id,
      nomeDevedor: f.nomeDevedor,
      emailDevedor: f.emailDevedor.value,
      descricao: f.descricao,
      valor: f.valor.toDecimal(),
      valorCents: f.valor.cents,
      dataVencimento: f.dataVencimento,
      timezone: f.timezone,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
      lembretes: f.lembretes.map((l) => ({
        id: l.id,
        tipo: l.tipo,
        status: l.status,
        dataEnvio: l.dataEnvio.toISOString(),
        tentativas: l.tentativas,
        proximaTentativa: l.proximaTentativa ? l.proximaTentativa.toISOString() : null,
        erro: l.erroMsg ?? null,
      })),
    };
  }
}
