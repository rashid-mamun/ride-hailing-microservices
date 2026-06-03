import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LocationService } from './location.service';

@Injectable()
export class OfflineDriverCleanup {
    constructor(private readonly locationService: LocationService) {}
    @Cron(CronExpression.EVERY_30_SECONDS)
    cleanup() {
        return this.locationService.cleanupOfflineDrivers();
    }
}
