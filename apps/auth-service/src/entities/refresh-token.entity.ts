import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 500, unique: true })
    token!: string;

    @Column('uuid')
    userId!: string;

    @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
    user!: User;

    @Column({ type: 'timestamp' })
    expiresAt!: Date;

    @Column({ default: false })
    isRevoked!: boolean;

    @CreateDateColumn()
    createdAt!: Date;
}
