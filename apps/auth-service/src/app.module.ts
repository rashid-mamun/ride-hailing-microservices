import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { validationSchema } from './config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { Driver } from './entities/driver.entity';
import { CreateAuthSchema1710000000000 } from './migrations/1710000000000-CreateAuthSchema';
import { FixRefreshTokenConstraints1710000000001 } from './migrations/1710000000001-FixRefreshTokenConstraints';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema }),
        JwtModule.register({}),
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.POSTGRES_AUTH_URL,
            entities: [User, RefreshToken, Driver],
            migrations: [CreateAuthSchema1710000000000, FixRefreshTokenConstraints1710000000001],
            migrationsRun: process.env.NODE_ENV !== 'test',
            synchronize: false,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        }),
        TypeOrmModule.forFeature([User, RefreshToken, Driver]),
    ],
    controllers: [HealthController, AuthController],
    providers: [AuthService],
})
export class AppModule {}
