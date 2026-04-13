import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { FaturaService } from '../services/fatura.service';
import { CreateFaturaDto } from '../dto/create-fatura.dto';
import { Fatura } from '../entities/fatura.entity';

@Controller('faturas')
export class FaturaController {
  constructor(private readonly faturaService: FaturaService) {}

  /**
   * Cria uma nova fatura e agenda automaticamente os lembretes
   * da régua de cobranças (D-3, D+1, D+7).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async criarFatura(@Body() dto: CreateFaturaDto): Promise<Fatura> {
    return this.faturaService.criarFatura(dto);
  }

  /**
   * Lista faturas de um usuário com paginação.
   */
  @Get()
  async listarFaturas(
    @Query('userId') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ): Promise<{ data: Fatura[]; total: number; page: number; limit: number }> {
    const resultado = await this.faturaService.listarFaturasPorUsuario(
      userId,
      Number(page),
      Number(limit),
    );
    return {
      ...resultado,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Busca uma fatura específica por ID, incluindo seus lembretes agendados.
   */
  @Get(':id')
  async buscarFatura(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Fatura> {
    const fatura = await this.faturaService.buscarFaturaPorId(id);

    if (!fatura) {
      throw new NotFoundException(`Fatura com ID ${id} não encontrada`);
    }

    return fatura;
  }
}
