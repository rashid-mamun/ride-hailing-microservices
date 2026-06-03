import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('outbox_events')
export class OutboxEvent {
    @PrimaryGeneratedColumn('uuid') id!: string;
    @Column('uuid') aggregateId!: string;
    @Column({ type: 'varchar', length: 50 }) aggregateType!: string;
    @Column({ type: 'varchar', length: 100 }) eventType!: string;
    @Column({ type: 'jsonb' }) payload!: Record<string, unknown>;
    @Column({ type: 'enum', enum: ['pending', 'published', 'failed'], default: 'pending' })
    status!: 'pending' | 'published' | 'failed';
    @Column({ type: 'integer', default: 0 }) attempts!: number;
    @Column({ type: 'timestamp', nullable: true }) lastAttemptAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) publishedAt?: Date;
    @Column({ type: 'timestamp', default: () => 'now()' }) createdAt!: Date;
}
