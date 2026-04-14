import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('outbox_events')
@Index('idx_outbox_pending', ['processedAt', 'occurredAt'])
export class OutboxOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid' })
  aggregateId!: string;

  @Column({ type: 'varchar', length: 128 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: object;

  @Column({ type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
