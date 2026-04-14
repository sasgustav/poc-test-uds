import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { FaturaStatus } from '../../../domain/enums/fatura-status.enum';

export class UpdateFaturaStatusDto {
  @ApiProperty({ enum: FaturaStatus, example: FaturaStatus.PAGA })
  @IsEnum(FaturaStatus)
  status!: FaturaStatus;
}
