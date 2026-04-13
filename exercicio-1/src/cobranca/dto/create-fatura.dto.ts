import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsDateString,
  IsUUID,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFaturaDto {
  @IsUUID('4', { message: 'userId deve ser um UUID v4 válido' })
  @IsNotEmpty({ message: 'userId é obrigatório' })
  userId: string;

  @IsString({ message: 'nomeDevedor deve ser uma string' })
  @IsNotEmpty({ message: 'nomeDevedor é obrigatório' })
  @MaxLength(255, { message: 'nomeDevedor deve ter no máximo 255 caracteres' })
  nomeDevedor: string;

  @IsEmail({}, { message: 'emailDevedor deve ser um e-mail válido' })
  @IsNotEmpty({ message: 'emailDevedor é obrigatório' })
  emailDevedor: string;

  @IsString({ message: 'descricao deve ser uma string' })
  @IsNotEmpty({ message: 'descricao é obrigatória' })
  @MaxLength(255, { message: 'descricao deve ter no máximo 255 caracteres' })
  descricao: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'valor deve ser numérico com no máximo 2 casas decimais' },
  )
  @IsPositive({ message: 'valor deve ser positivo' })
  valor: number;

  @IsDateString({}, { message: 'dataVencimento deve ser uma data válida (YYYY-MM-DD)' })
  @IsNotEmpty({ message: 'dataVencimento é obrigatória' })
  dataVencimento: string;
}
