import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { FaturaStatus } from '../../../../domain/enums/fatura-status.enum';
import { LembreteOrmEntity } from './lembrete.orm-entity';

@Entity('faturas')
@Index('idx_faturas_user_vencimento', ['userId', 'dataVencimento'])
@Index('idx_faturas_user_created', ['userId', 'createdAt'])
export class FaturaOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 255 })
  nomeDevedor!: string;

  @Column({ type: 'varchar', length: 255 })
  emailDevedor!: string;

  @Column({ type: 'varchar', length: 255 })
  descricao!: string;

  /** Armazenado em centavos (bigint) — fonte da verdade. Display faz divisão por 100. */
  @Column({ type: 'bigint', name: 'valor_cents' })
  valorCents!: string;

  @Column({ type: 'varchar', length: 3, default: 'BRL' })
  currency!: string;

  @Column({ type: 'date' })
  dataVencimento!: string;

  @Column({ type: 'varchar', length: 64, default: 'America/Sao_Paulo' })
  timezone!: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: FaturaStatus.PENDENTE,
  })
  status!: FaturaStatus;

  @OneToMany(() => LembreteOrmEntity, (l) => l.fatura, { cascade: false })
  lembretes!: LembreteOrmEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
