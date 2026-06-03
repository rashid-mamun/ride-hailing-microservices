import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('payments')
export class Payment {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('uuid')
    rideId!: string;

    @Column('uuid')
    riderId!: string;

    @Column('uuid')
    driverId!: string;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount!: string;

    @Column({ type: 'varchar', length: 3, default: 'BDT' })
    currency!: string;

    @Column({ type: 'enum', enum: ['pending', 'processed', 'failed'], default: 'pending' })
    status!: 'pending' | 'processed' | 'failed';

    @Column({ type: 'varchar', length: 100, unique: true })
    transactionId!: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    failureReason?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
