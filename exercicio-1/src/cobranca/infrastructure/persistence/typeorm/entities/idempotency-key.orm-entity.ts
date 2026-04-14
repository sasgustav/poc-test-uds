import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('idempotency_keys')
@Index('idx_idempotency_expires', ['expiresAt'])
export class IdempotencyKeyOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  key!: string;

  @Column({ type: 'varchar', length: 64 })
  requestHash!: string;

  @Column({ type: 'int' })
  statusCode!: number;

  @Column({ type: 'jsonb' })
  responseBody!: unknown;

  @Column({ type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
