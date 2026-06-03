import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePayments1710000000000 } from './migrations/1710000000000-CreatePayments';

export default new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_PAYMENT_URL,
    entities: [Payment],
    migrations: [CreatePayments1710000000000],
    synchronize: false,
});
