import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Fatura } from '../entities/fatura.entity';
import { LembreteAgendado } from '../entities/lembrete-agendado.entity';
import { CreateFaturaDto } from '../dto/create-fatura.dto';
import { FaturaStatus } from '../enums/fatura-status.enum';
import { LembreteStatus } from '../enums/lembrete-status.enum';
import { LembreteTipo } from '../enums/lembrete-tipo.enum';

/**
 * Configuração dos offsets da régua de cobranças.
 * Centralizado aqui para facilitar manutenção e eventual configuração via env/banco.
 */
const REGUA_COBRANCA_OFFSETS: { tipo: LembreteTipo; diasOffset: number }[] = [
  { tipo: LembreteTipo.D_MENOS_3, diasOffset: -3 },
  { tipo: LembreteTipo.D_MAIS_1, diasOffset: 1 },
  { tipo: LembreteTipo.D_MAIS_7, diasOffset: 7 },
];

@Injectable()
export class FaturaService {
  private readonly logger = new Logger(FaturaService.name);

  constructor(
    @InjectRepository(Fatura)
    private readonly faturaRepository: Repository<Fatura>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Cria uma fatura e agenda automaticamente os lembretes da régua de cobranças.
   *
   * Utiliza uma transação para garantir atomicidade: se a criação de qualquer
   * lembrete falhar, a fatura também não é criada, evitando estados inconsistentes.
   */
  async criarFatura(dto: CreateFaturaDto): Promise<Fatura> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fatura = queryRunner.manager.create(Fatura, {
        userId: dto.userId,
        nomeDevedor: dto.nomeDevedor,
        emailDevedor: dto.emailDevedor,
        descricao: dto.descricao,
        valor: dto.valor,
        dataVencimento: dto.dataVencimento,
        status: FaturaStatus.PENDENTE,
      });

      const faturaSalva = await queryRunner.manager.save(Fatura, fatura);

      const lembretes = REGUA_COBRANCA_OFFSETS.map((offset) => {
        const dataEnvio = this.calcularDataEnvio(
          dto.dataVencimento,
          offset.diasOffset,
        );

        return queryRunner.manager.create(LembreteAgendado, {
          faturaId: faturaSalva.id,
          dataEnvio,
          tipo: offset.tipo,
          status: LembreteStatus.PENDENTE,
          tentativas: 0,
        });
      });

      await queryRunner.manager.save(LembreteAgendado, lembretes);
      await queryRunner.commitTransaction();

      this.logger.log(
        `Fatura ${faturaSalva.id} criada com ${lembretes.length} lembretes agendados`,
      );

      const faturaCompleta = await this.buscarFaturaPorId(faturaSalva.id);
      return faturaCompleta!;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Erro ao criar fatura: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Erro ao criar fatura. Tente novamente.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async buscarFaturaPorId(id: string): Promise<Fatura | null> {
    return this.faturaRepository.findOne({
      where: { id },
      relations: ['lembretes'],
    });
  }

  async listarFaturasPorUsuario(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Fatura[]; total: number }> {
    const [data, total] = await this.faturaRepository.findAndCount({
      where: { userId },
      relations: ['lembretes'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  /**
   * Calcula a data de envio do lembrete com base na data de vencimento e offset em dias.
   * O horário é fixado em 09:00 UTC para envio em horário comercial.
   */
  private calcularDataEnvio(dataVencimento: string, diasOffset: number): Date {
    const data = new Date(dataVencimento);
    data.setDate(data.getDate() + diasOffset);
    data.setUTCHours(9, 0, 0, 0);
    return data;
  }
}
