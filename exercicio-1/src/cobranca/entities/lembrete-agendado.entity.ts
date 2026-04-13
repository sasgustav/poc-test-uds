import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LembreteStatus } from '../enums/lembrete-status.enum';
import { LembreteTipo } from '../enums/lembrete-tipo.enum';
import { Fatura } from './fatura.entity';

@Entity('lembretes_agendados')
@Index(['status', 'dataEnvio'])
export class LembreteAgendado {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  faturaId: string;

  @ManyToOne(() => Fatura, (fatura) => fatura.lembretes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'faturaId' })
  fatura: Fatura;

  /**
   * Data/hora programada para o envio do lembrete.
   * Calculada automaticamente a partir da dataVencimento da fatura:
   * D-3 = vencimento - 3 dias, D+1 = vencimento + 1 dia, D+7 = vencimento + 7 dias.
   */
  @Column({ type: 'timestamptz' })
  dataEnvio: Date;

  @Column({
    type: 'enum',
    enum: LembreteTipo,
  })
  tipo: LembreteTipo;

  @Column({
    type: 'enum',
    enum: LembreteStatus,
    default: LembreteStatus.PENDENTE,
  })
  status: LembreteStatus;

  /**
   * Contador de tentativas de envio.
   * Permite retry automático até MAX_RETRIES antes de marcar como 'falhou'.
   */
  @Column({ type: 'int', default: 0 })
  tentativas: number;

  @Column({ type: 'text', nullable: true })
  erroMsg: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processadoEm: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
