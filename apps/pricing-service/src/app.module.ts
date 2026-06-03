import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { validationSchema } from './config';
import { PricingRule } from './pricing-rule.entity';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { PricingEventsConsumer } from './pricing-events.consumer';
import { CreatePricingSchema1710000000000 } from './migrations/1710000000000-CreatePricingSchema';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema }),
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.POSTGRES_PRICING_URL,
            entities: [PricingRule],
            migrations: [CreatePricingSchema1710000000000],
            migrationsRun: process.env.NODE_ENV !== 'test',
            synchronize: false,
        }),
        TypeOrmModule.forFeature([PricingRule]),
    ],
    controllers: [HealthController, PricingController],
    providers: [PricingService, PricingEventsConsumer],
})
export class AppModule {}
