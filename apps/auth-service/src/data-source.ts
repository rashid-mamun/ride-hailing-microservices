import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Driver } from './entities/driver.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { CreateAuthSchema1710000000000 } from './migrations/1710000000000-CreateAuthSchema';
import { FixRefreshTokenConstraints1710000000001 } from './migrations/1710000000001-FixRefreshTokenConstraints';

export default new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_AUTH_URL,
    entities: [User, RefreshToken, Driver],
    migrations: [CreateAuthSchema1710000000000, FixRefreshTokenConstraints1710000000001],
    synchronize: false,
});
