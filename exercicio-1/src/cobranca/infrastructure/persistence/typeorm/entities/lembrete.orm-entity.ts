import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LembreteStatus } from '../../../../domain/enums/lembrete-status.enum';
import { LembreteTipo } from '../../../../domain/enums/lembrete-tipo.enum';
import { FaturaOrmEntity } from './fatura.orm-entity';

@Entity('lembretes_agendados')
@Index('idx_lembretes_status_proxima', ['status', 'proximaTentativa'])
@Index('idx_lembretes_fatura', ['faturaId'])
export class LembreteOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  faturaId!: string;

  @ManyToOne(() => FaturaOrmEntity, (f) => f.lembretes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'faturaId' })
  fatura!: FaturaOrmEntity;

  @Column({ type: 'timestamptz' })
  dataEnvio!: Date;

  @Column({ type: 'varchar', length: 8 })
  tipo!: LembreteTipo;

  @Column({ type: 'varchar', length: 16, default: LembreteStatus.PENDENTE })
  status!: LembreteStatus;

  @Column({ type: 'int', default: 0 })
  tentativas!: number;

  @Column({ type: 'text', nullable: true })
  erroMsg!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  processadoEm!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  proximaTentativa!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
