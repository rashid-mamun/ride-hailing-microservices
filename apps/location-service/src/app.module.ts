import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { validationSchema } from './config';
import { LocationController } from './location.controller';
import { LocationGateway } from './location.gateway';
import { LocationService } from './location.service';
import { OfflineDriverCleanup } from './offline-driver.cleanup';

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, validationSchema }), ScheduleModule.forRoot()],
    controllers: [HealthController, LocationController],
    providers: [LocationService, LocationGateway, OfflineDriverCleanup],
})
export class AppModule {}
