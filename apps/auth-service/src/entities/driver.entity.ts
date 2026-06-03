import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('drivers')
export class Driver {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column('uuid', { unique: true })
    userId!: string;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    @Column({ type: 'varchar', length: 100 })
    vehicleModel!: string;

    @Column({ type: 'varchar', length: 20, unique: true })
    vehiclePlate!: string;

    @Column({ default: false })
    isAvailable!: boolean;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    currentLat?: string;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    currentLng?: string;

    @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0 })
    rating!: string;

    @Column({ type: 'integer', default: 0 })
    totalRides!: number;
}
