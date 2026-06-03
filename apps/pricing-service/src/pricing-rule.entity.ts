import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('pricing_rules')
export class PricingRule {
    @PrimaryGeneratedColumn('uuid') id!: string;
    @Column({ type: 'varchar', length: 100 }) name!: string;
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 30 }) baseFare!: string;
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 12 }) perKmRate!: string;
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 1.5 }) perMinuteRate!: string;
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 50 }) minimumFare!: string;
    @Column({ type: 'decimal', precision: 4, scale: 2, default: 1 }) surgeMultiplier!: string;
    @Column({ default: true }) isActive!: boolean;
    @CreateDateColumn() createdAt!: Date;
    @UpdateDateColumn() updatedAt!: Date;
}
