import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { NearbyDriversDto, UpdateLocationDto } from './dto/location.dto';

@Injectable()
export class LocationService {
    private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    async updateDriverLocation(driverId: string, dto: UpdateLocationDto) {
        await this.redis.geoadd('drivers:available', dto.lng, dto.lat, driverId);
        await this.redis.hset(`driver:${driverId}:meta`, {
            lat: dto.lat,
            lng: dto.lng,
            heading: dto.heading,
            speed: dto.speed,
            updatedAt: new Date().toISOString(),
            rideId: dto.rideId || '',
        });
        await this.redis.expire(`driver:${driverId}:meta`, 30);
        return { driverId, ...dto };
    }

    async nearby(query: NearbyDriversDto) {
        const rows = (await this.redis.call(
            'GEOSEARCH',
            'drivers:available',
            'FROMLONLAT',
            query.lng,
            query.lat,
            'BYRADIUS',
            query.radiusKm,
            'km',
            'ASC',
            'COUNT',
            query.limit,
            'WITHDIST',
        )) as Array<[string, string]>;
        const drivers = await Promise.all(
            rows.map(async ([driverId, distanceKm]) => {
                const meta = await this.redis.hgetall(`driver:${driverId}:meta`);
                if (!meta.lat || !meta.lng) return undefined;
                return {
                    driverId,
                    lat: Number(meta.lat),
                    lng: Number(meta.lng),
                    distanceKm: Number(distanceKm),
                    heading: Number(meta.heading),
                    speed: Number(meta.speed),
                };
            }),
        );
        return drivers.filter((driver): driver is NonNullable<typeof driver> => Boolean(driver));
    }

    async cleanupOfflineDrivers() {
        const ids = await this.redis.zrange('drivers:available', 0, -1);
        for (const id of ids) {
            if ((await this.redis.ttl(`driver:${id}:meta`)) < 0)
                await this.redis.zrem('drivers:available', id);
        }
    }
}
