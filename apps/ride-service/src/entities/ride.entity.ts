import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { RideStatus } from '@ride-hailing/shared-types';

@Entity('rides')
export class Ride {
    @PrimaryGeneratedColumn('uuid') id!: string;
    @Column('uuid') riderId!: string;
    @Column('uuid', { nullable: true }) driverId?: string;
    @Column({
        type: 'enum',
        enum: [
            'requested',
            'driver_matched',
            'driver_arrived',
            'in_progress',
            'completed',
            'cancelled',
        ],
        default: 'requested',
    })
    status!: RideStatus;
    @Column({ type: 'varchar', length: 255 }) pickupAddress!: string;
    @Column({ type: 'decimal', precision: 10, scale: 7 }) pickupLat!: string;
    @Column({ type: 'decimal', precision: 10, scale: 7 }) pickupLng!: string;
    @Column({ type: 'varchar', length: 255 }) dropoffAddress!: string;
    @Column({ type: 'decimal', precision: 10, scale: 7 }) dropoffLat!: string;
    @Column({ type: 'decimal', precision: 10, scale: 7 }) dropoffLng!: string;
    @Column({ type: 'decimal', precision: 10, scale: 2 }) estimatedFare!: string;
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) finalFare?: string;
    @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
    estimatedDistanceKm?: string;
    @Column({ type: 'integer', nullable: true }) estimatedDurationMinutes?: number;
    @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true }) actualDistanceKm?: string;
    @Column({ type: 'integer', nullable: true }) actualDurationMinutes?: number;
    @Column({ type: 'timestamp', default: () => 'now()' }) requestedAt!: Date;
    @Column({ type: 'timestamp', nullable: true }) matchedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) startedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) completedAt?: Date;
    @Column({ type: 'timestamp', nullable: true }) cancelledAt?: Date;
    @Column({ type: 'varchar', length: 500, nullable: true }) cancellationReason?: string;
    @Column({ type: 'enum', enum: ['rider', 'driver', 'system'], nullable: true }) cancelledBy?:
        | 'rider'
        | 'driver'
        | 'system';
}
