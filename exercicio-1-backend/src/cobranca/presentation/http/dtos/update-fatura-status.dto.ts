import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { FaturaStatus } from '../../../domain/enums/fatura-status.enum';

/** Apenas transições acionáveis externamente. VENCIDA é transição sistêmica (cron). */
const ALLOWED_TARGET_STATUSES = [FaturaStatus.PAGA, FaturaStatus.CANCELADA] as const;

export class UpdateFaturaStatusDto {
  @ApiProperty({
    enum: [FaturaStatus.PAGA, FaturaStatus.CANCELADA],
    example: FaturaStatus.PAGA,
    description: 'Status alvo. Apenas PAGA e CANCELADA podem ser solicitados via API.',
  })
  @IsIn(ALLOWED_TARGET_STATUSES, {
    message: `status deve ser um dos seguintes: ${ALLOWED_TARGET_STATUSES.join(', ')}`,
  })
  status!: FaturaStatus;
}
