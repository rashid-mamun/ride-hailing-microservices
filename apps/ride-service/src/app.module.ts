import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { validationSchema } from './config';
import { Ride } from './entities/ride.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { RideController } from './ride.controller';
import { RideService } from './ride.service';
import { OutboxPublisher } from './outbox.publisher';
import { PricingClient } from './pricing.client';
import { LocationClient } from './location.client';
import { RideEventConsumer } from './ride-event.consumer';
import { CreateRideSchema1710000000000 } from './migrations/1710000000000-CreateRideSchema';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true, validationSchema }),
        ScheduleModule.forRoot(),
        TypeOrmModule.forRoot({
            type: 'postgres',
            url: process.env.POSTGRES_RIDE_URL,
            entities: [Ride, OutboxEvent],
            migrations: [CreateRideSchema1710000000000],
            migrationsRun: process.env.NODE_ENV !== 'test',
            synchronize: false,
        }),
        TypeOrmModule.forFeature([Ride, OutboxEvent]),
    ],
    controllers: [HealthController, RideController],
    providers: [RideService, OutboxPublisher, PricingClient, LocationClient, RideEventConsumer],
})
export class AppModule {}
