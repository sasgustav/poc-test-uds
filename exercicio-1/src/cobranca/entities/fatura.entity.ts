import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { FaturaStatus } from '../enums/fatura-status.enum';
import { LembreteAgendado } from './lembrete-agendado.entity';

@Entity('faturas')
export class Fatura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identificador do usuário responsável pela fatura.
   * Indexado para queries eficientes de listagem por tenant.
   */
  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  /**
   * Nome do devedor/cliente da fatura.
   * Necessário para personalizar os lembretes de cobrança.
   */
  @Column({ type: 'varchar', length: 255 })
  nomeDevedor: string;

  /**
   * E-mail do devedor para envio dos lembretes da régua de cobranças.
   * É o destinatário dos e-mails em D-3, D+1 e D+7.
   */
  @Column({ type: 'varchar', length: 255 })
  emailDevedor: string;

  @Column({ type: 'varchar', length: 255 })
  descricao: string;

  /**
   * Valor monetário da fatura.
   * Utiliza decimal(12,2) para precisão financeira — nunca float,
   * que introduz erros de arredondamento inaceitáveis em contexto financeiro.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  valor: number;

  /**
   * Data de vencimento da fatura.
   * É o ponto de referência para cálculo dos lembretes da régua de cobranças:
   * D-3 (3 dias antes), D+1 (1 dia depois), D+7 (7 dias depois).
   */
  @Column({ type: 'date' })
  dataVencimento: string;

  @Column({
    type: 'enum',
    enum: FaturaStatus,
    default: FaturaStatus.PENDENTE,
  })
  status: FaturaStatus;

  @OneToMany(() => LembreteAgendado, (lembrete) => lembrete.fatura, {
    cascade: true,
  })
  lembretes: LembreteAgendado[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
