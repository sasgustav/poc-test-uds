import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LembreteSchedulerService } from '../src/cobranca/services/lembrete-scheduler.service';
import { LembreteAgendado } from '../src/cobranca/entities/lembrete-agendado.entity';
import { LembreteStatus } from '../src/cobranca/enums/lembrete-status.enum';
import { LembreteTipo } from '../src/cobranca/enums/lembrete-tipo.enum';

describe('LembreteSchedulerService', () => {
  let service: LembreteSchedulerService;
  let lembreteRepository: Record<string, jest.Mock>;
  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    lembreteRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LembreteSchedulerService,
        {
          provide: getRepositoryToken(LembreteAgendado),
          useValue: lembreteRepository,
        },
      ],
    }).compile();

    service = module.get<LembreteSchedulerService>(LembreteSchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processarLembretesPendentes', () => {
    it('não deve fazer nada quando não há lembretes pendentes', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.processarLembretesPendentes();

      expect(lembreteRepository.update).not.toHaveBeenCalled();
    });

    it('deve processar lembretes pendentes e marcar como enviado', async () => {
      const lembrete: Partial<LembreteAgendado> = {
        id: 'lembrete-uuid-1',
        faturaId: 'fatura-uuid-1',
        tipo: LembreteTipo.D_MENOS_3,
        status: LembreteStatus.PENDENTE,
        tentativas: 0,
        dataEnvio: new Date('2025-01-10T09:00:00Z'),
      };

      mockQueryBuilder.getMany.mockResolvedValue([lembrete]);

      await service.processarLembretesPendentes();

      expect(lembreteRepository.update).toHaveBeenCalledWith(
        'lembrete-uuid-1',
        expect.objectContaining({
          status: LembreteStatus.ENVIADO,
          tentativas: 1,
          processadoEm: expect.any(Date),
        }),
      );
    });

    it('deve usar SELECT FOR UPDATE SKIP LOCKED para buscar lembretes', async () => {
      await service.processarLembretesPendentes();

      expect(lembreteRepository.createQueryBuilder).toHaveBeenCalledWith('lembrete');
      expect(mockQueryBuilder.setLock).toHaveBeenCalledWith(
        'pessimistic_write',
        undefined,
        ['lembrete'],
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'lembrete.status = :status',
        { status: LembreteStatus.PENDENTE },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'lembrete.dataEnvio <= NOW()',
      );
    });

    it('deve marcar lembrete como falhou após exceder MAX_RETRIES (3)', async () => {
      const lembrete: Partial<LembreteAgendado> = {
        id: 'lembrete-uuid-2',
        faturaId: 'fatura-uuid-2',
        tipo: LembreteTipo.D_MAIS_1,
        status: LembreteStatus.PENDENTE,
        tentativas: 2, // Já tentou 2 vezes, a próxima será a 3ª (MAX_RETRIES)
        dataEnvio: new Date('2025-01-10T09:00:00Z'),
      };

      mockQueryBuilder.getMany.mockResolvedValue([lembrete]);

      // Simula falha no envio fazendo o método privado enviarEmail lançar erro
      jest
        .spyOn(service as any, 'enviarEmail')
        .mockRejectedValue(new Error('SMTP timeout'));

      await service.processarLembretesPendentes();

      expect(lembreteRepository.update).toHaveBeenCalledWith(
        'lembrete-uuid-2',
        expect.objectContaining({
          status: LembreteStatus.FALHOU,
          tentativas: 3,
          erroMsg: 'SMTP timeout',
        }),
      );
    });

    it('deve manter status pendente quando falha mas ainda tem tentativas', async () => {
      const lembrete: Partial<LembreteAgendado> = {
        id: 'lembrete-uuid-3',
        faturaId: 'fatura-uuid-3',
        tipo: LembreteTipo.D_MAIS_7,
        status: LembreteStatus.PENDENTE,
        tentativas: 0,
        dataEnvio: new Date('2025-01-10T09:00:00Z'),
      };

      mockQueryBuilder.getMany.mockResolvedValue([lembrete]);

      jest
        .spyOn(service as any, 'enviarEmail')
        .mockRejectedValue(new Error('Conexão recusada'));

      await service.processarLembretesPendentes();

      expect(lembreteRepository.update).toHaveBeenCalledWith(
        'lembrete-uuid-3',
        expect.objectContaining({
          status: LembreteStatus.PENDENTE,
          tentativas: 1,
          erroMsg: 'Conexão recusada',
        }),
      );
    });

    it('deve processar múltiplos lembretes em sequência', async () => {
      const lembretes: Partial<LembreteAgendado>[] = [
        {
          id: 'lembrete-1',
          faturaId: 'fatura-1',
          tipo: LembreteTipo.D_MENOS_3,
          status: LembreteStatus.PENDENTE,
          tentativas: 0,
          dataEnvio: new Date('2025-01-10T09:00:00Z'),
        },
        {
          id: 'lembrete-2',
          faturaId: 'fatura-2',
          tipo: LembreteTipo.D_MAIS_1,
          status: LembreteStatus.PENDENTE,
          tentativas: 0,
          dataEnvio: new Date('2025-01-10T09:00:00Z'),
        },
      ];

      mockQueryBuilder.getMany.mockResolvedValue(lembretes);

      await service.processarLembretesPendentes();

      expect(lembreteRepository.update).toHaveBeenCalledTimes(2);
    });
  });
});
