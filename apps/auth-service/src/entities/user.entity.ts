import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import type { UserRole } from '@ride-hailing/shared-types';
import { RefreshToken } from './refresh-token.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    email!: string;

    @Column({ type: 'varchar', length: 255 })
    passwordHash!: string;

    @Column({ type: 'enum', enum: ['rider', 'driver', 'admin'], default: 'rider' })
    role!: UserRole;

    @Column({ type: 'varchar', length: 100 })
    firstName!: string;

    @Column({ type: 'varchar', length: 100 })
    lastName!: string;

    @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
    phoneNumber?: string;

    @Column({ default: true })
    isActive!: boolean;

    @Column({ default: false })
    isEmailVerified!: boolean;

    @OneToMany(() => RefreshToken, (token) => token.user)
    refreshTokens!: RefreshToken[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
