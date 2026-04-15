import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateFaturaDto {
  @ApiProperty({ example: 'Maria Silva', minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  nomeDevedor!: string;

  @ApiProperty({ example: 'maria@example.com' })
  @IsEmail()
  emailDevedor!: string;

  @ApiProperty({ example: 'Fatura referente ao plano anual', minLength: 3, maxLength: 500 })
  @IsString()
  @Length(3, 500)
  descricao!: string;

  @ApiProperty({
    example: 1500.5,
    description: 'Valor em reais com até 2 casas decimais. Persistido em centavos.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000)
  valor!: number;

  @ApiProperty({ example: '2026-05-10', description: 'Data de vencimento ISO-8601 (YYYY-MM-DD).' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataVencimento deve ser YYYY-MM-DD' })
  dataVencimento!: string;

  @ApiProperty({
    required: false,
    example: 'America/Sao_Paulo',
    description: 'Timezone IANA do devedor. Default: env DEFAULT_TIMEZONE.',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
