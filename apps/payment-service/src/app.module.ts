import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validationSchema } from './config';
import { HealthController } from './health.controller';
import { Payment } from './entities/payment.entity';
import { CreatePayments1710000000000 } from './migrations/1710000000000-CreatePayments';
import { PaymentEventsConsumer } from './payment-events.consumer';
import { PaymentService } from './payment.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema }),
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.POSTGRES_PAYMENT_URL,
            entities: [Payment],
            migrations: [CreatePayments1710000000000],
            migrationsRun: process.env.NODE_ENV !== 'test',
            synchronize: false,
        }),
        TypeOrmModule.forFeature([Payment]),
    ],
    controllers: [HealthController],
    providers: [PaymentService, PaymentEventsConsumer],
})
export class AppModule {}
