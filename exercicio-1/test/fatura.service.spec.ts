import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import { FaturaService } from '../src/cobranca/services/fatura.service';
import { Fatura } from '../src/cobranca/entities/fatura.entity';
import { LembreteAgendado } from '../src/cobranca/entities/lembrete-agendado.entity';
import { CreateFaturaDto } from '../src/cobranca/dto/create-fatura.dto';
import { FaturaStatus } from '../src/cobranca/enums/fatura-status.enum';
import { LembreteStatus } from '../src/cobranca/enums/lembrete-status.enum';
import { LembreteTipo } from '../src/cobranca/enums/lembrete-tipo.enum';

describe('FaturaService', () => {
  let service: FaturaService;
  let faturaRepository: Record<string, jest.Mock>;
  let queryRunner: Partial<QueryRunner>;
  let dataSource: Partial<DataSource>;

  const mockManager = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockManager as any,
    };

    dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };

    faturaRepository = {
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaturaService,
        {
          provide: getRepositoryToken(Fatura),
          useValue: faturaRepository,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
      ],
    }).compile();

    service = module.get<FaturaService>(FaturaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('criarFatura', () => {
    const dto: CreateFaturaDto = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      nomeDevedor: 'João Silva',
      emailDevedor: 'joao@empresa.com',
      descricao: 'Fatura de teste',
      valor: 1500.50,
      dataVencimento: '2025-02-15',
    };

    it('deve criar uma fatura com 3 lembretes agendados dentro de uma transação', async () => {
      const faturaCriada = { id: 'fatura-uuid-123', ...dto, status: FaturaStatus.PENDENTE };

      mockManager.create
        .mockReturnValueOnce(faturaCriada) // Fatura
        .mockReturnValueOnce({ tipo: LembreteTipo.D_MENOS_3 }) // D-3
        .mockReturnValueOnce({ tipo: LembreteTipo.D_MAIS_1 })  // D+1
        .mockReturnValueOnce({ tipo: LembreteTipo.D_MAIS_7 }); // D+7

      mockManager.save
        .mockResolvedValueOnce(faturaCriada)   // Save Fatura
        .mockResolvedValueOnce([]);             // Save Lembretes

      faturaRepository.findOne.mockResolvedValue({
        ...faturaCriada,
        lembretes: [
          { tipo: LembreteTipo.D_MENOS_3, status: LembreteStatus.PENDENTE },
          { tipo: LembreteTipo.D_MAIS_1, status: LembreteStatus.PENDENTE },
          { tipo: LembreteTipo.D_MAIS_7, status: LembreteStatus.PENDENTE },
        ],
      });

      const resultado = await service.criarFatura(dto);

      // Verifica que a transação foi iniciada e commitada
      expect(queryRunner.connect).toHaveBeenCalled();
      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();

      // Verifica que rollback NÃO foi chamado
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();

      // Verifica que a fatura foi criada
      expect(mockManager.save).toHaveBeenCalledWith(Fatura, faturaCriada);

      // Verifica que 3 lembretes foram criados (D-3, D+1, D+7)
      expect(mockManager.create).toHaveBeenCalledTimes(4); // 1 fatura + 3 lembretes

      // Verifica retorno com lembretes
      expect(resultado.lembretes).toHaveLength(3);
    });

    it('deve calcular corretamente as datas dos lembretes em relação ao vencimento', async () => {
      const faturaCriada = { id: 'fatura-uuid-456', ...dto, status: FaturaStatus.PENDENTE };
      const lembretesCapturados: any[] = [];

      mockManager.create.mockImplementation((_entity: any, data: any) => {
        if (data?.tipo) lembretesCapturados.push(data);
        return { ...data, id: faturaCriada.id };
      });

      mockManager.save
        .mockResolvedValueOnce(faturaCriada)
        .mockResolvedValueOnce([]);

      faturaRepository.findOne.mockResolvedValue({ ...faturaCriada, lembretes: [] });

      await service.criarFatura(dto);

      // Extrai os lembretes passados para create (posições 1, 2, 3 — a posição 0 é a fatura)
      expect(lembretesCapturados).toHaveLength(3);

      // D-3: 15/02/2025 - 3 dias = 12/02/2025
      const d3 = new Date(lembretesCapturados[0].dataEnvio);
      expect(d3.getUTCDate()).toBe(12);
      expect(d3.getUTCMonth()).toBe(1); // Fevereiro = 1

      // D+1: 15/02/2025 + 1 dia = 16/02/2025
      const d1 = new Date(lembretesCapturados[1].dataEnvio);
      expect(d1.getUTCDate()).toBe(16);

      // D+7: 15/02/2025 + 7 dias = 22/02/2025
      const d7 = new Date(lembretesCapturados[2].dataEnvio);
      expect(d7.getUTCDate()).toBe(22);
    });

    it('deve fazer rollback da transação em caso de erro', async () => {
      mockManager.create.mockReturnValue({});
      mockManager.save.mockRejectedValue(new Error('Erro de banco'));

      await expect(service.criarFatura(dto)).rejects.toThrow(
        'Erro ao criar fatura. Tente novamente.',
      );

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('listarFaturasPorUsuario', () => {
    it('deve retornar faturas paginadas do usuário', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const faturas = [
        { id: '1', userId, descricao: 'Fatura 1' },
        { id: '2', userId, descricao: 'Fatura 2' },
      ];

      faturaRepository.findAndCount.mockResolvedValue([faturas, 2]);

      const resultado = await service.listarFaturasPorUsuario(userId, 1, 20);

      expect(resultado.data).toHaveLength(2);
      expect(resultado.total).toBe(2);
      expect(faturaRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId },
        relations: ['lembretes'],
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });
  });
});
