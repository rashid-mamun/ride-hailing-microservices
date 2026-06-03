import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import type { JwtPayload } from '@ride-hailing/shared-types';
import { PricingRule } from './pricing-rule.entity';
import { CreatePricingRuleDto, EstimateFareDto } from './pricing.dto';

@Injectable()
export class PricingService implements OnModuleInit {
    private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    constructor(@InjectRepository(PricingRule) private readonly rules: Repository<PricingRule>) {}
    async onModuleInit() {
        if (!(await this.rules.exists({ where: { isActive: true } })))
            await this.rules.save({ name: 'Default Dhaka Rule' });
    }
    async estimate(dto: EstimateFareDto) {
        const key = `fare:${dto.pickupLat.toFixed(5)},${dto.pickupLng.toFixed(5)},${dto.dropoffLat.toFixed(5)},${dto.dropoffLng.toFixed(5)}`;
        const cached = await this.redis.get(key);
        if (cached) return JSON.parse(cached);
        const rule = await this.rules.findOneByOrFail({ isActive: true });
        const distanceKm = this.haversine(
            dto.pickupLat,
            dto.pickupLng,
            dto.dropoffLat,
            dto.dropoffLng,
        );
        const estimatedMinutes = Math.ceil((distanceKm / 30) * 60);
        const zone = this.zone(dto.pickupLat, dto.pickupLng);
        const active = Number((await this.redis.get(`zone:${zone}:active_rides`)) || 0);
        const surge =
            active > Number(process.env.SURGE_THRESHOLD_2 || 100)
                ? 2
                : active > Number(process.env.SURGE_THRESHOLD_1 || 50)
                  ? 1.5
                  : Number(rule.surgeMultiplier);
        const baseFare = Number(rule.baseFare);
        const distanceFare = distanceKm * Number(rule.perKmRate);
        const timeFare = estimatedMinutes * Number(rule.perMinuteRate);
        const raw = Math.max(
            Number(rule.minimumFare),
            (baseFare + distanceFare + timeFare) * surge,
        );
        const result = {
            estimatedFare: Math.round(raw / 5) * 5,
            breakdown: {
                baseFare,
                distanceFare: Number(distanceFare.toFixed(2)),
                timeFare: Number(timeFare.toFixed(2)),
                surgeMultiplier: surge,
                distanceKm,
                estimatedMinutes,
            },
            currency: 'BDT',
        };
        await this.redis.set(key, JSON.stringify(result), 'EX', 120);
        return result;
    }
    async listRules(user: JwtPayload) {
        if (user.role !== 'admin') throw new ForbiddenException();
        return this.rules.find();
    }
    async createRule(user: JwtPayload, dto: CreatePricingRuleDto) {
        if (user.role !== 'admin') throw new ForbiddenException();
        return this.rules.save({
            ...dto,
            baseFare: String(dto.baseFare),
            perKmRate: String(dto.perKmRate),
            perMinuteRate: String(dto.perMinuteRate),
            minimumFare: String(dto.minimumFare),
            surgeMultiplier: String(dto.surgeMultiplier),
        });
    }
    async incrementZone(lat: number, lng: number) {
        await this.redis.incr(`zone:${this.zone(lat, lng)}:active_rides`);
    }
    async decrementZone(lat: number, lng: number) {
        const key = `zone:${this.zone(lat, lng)}:active_rides`;
        const value = await this.redis.decr(key);
        if (value < 0) await this.redis.set(key, '0');
    }
    haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
        const r = 6371,
            toRad = (n: number) => (n * Math.PI) / 180;
        const dLat = toRad(bLat - aLat),
            dLng = toRad(bLng - aLng);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
        return Number((2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
    }
    private zone(lat: number, lng: number) {
        return `${lat.toFixed(2)}:${lng.toFixed(2)}`;
    }
}
