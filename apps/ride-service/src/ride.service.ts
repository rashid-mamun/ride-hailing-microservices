import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource, Repository } from 'typeorm';
import { ROUTING_KEYS } from '@ride-hailing/shared-events';
import type { JwtPayload, RideStatus } from '@ride-hailing/shared-types';
import { Ride } from './entities/ride.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { CancelRideDto, CompleteRideDto, MatchRideDto, RequestRideDto } from './dto/ride.dto';
import { LocationClient } from './location.client';
import { PricingClient } from './pricing.client';

@Injectable()
export class RideService {
    private readonly redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(Ride) private readonly rides: Repository<Ride>,
        private readonly pricing: PricingClient,
        @Optional() private readonly location?: LocationClient,
    ) {}

    async requestRide(user: JwtPayload, dto: RequestRideDto, idempotencyKey?: string) {
        if (user.role !== 'rider') throw new ForbiddenException('rider role required');
        if (idempotencyKey) {
            const cached = await this.redis.get(`idempotency:ride:${user.sub}:${idempotencyKey}`);
            if (cached) return JSON.parse(cached) as Ride;
        }
        const estimate = await this.pricing.estimate({
            pickupLat: dto.pickupLat,
            pickupLng: dto.pickupLng,
            dropoffLat: dto.dropoffLat,
            dropoffLng: dto.dropoffLng,
        });
        const matchedDriver = (
            await this.location?.findNearbyDrivers(dto.pickupLat, dto.pickupLng)
        )?.[0];
        const ride = await this.dataSource.transaction(async (manager) => {
            const saved = await manager.save(
                Ride,
                manager.create(Ride, {
                    ...dto,
                    riderId: user.sub,
                    driverId: matchedDriver?.driverId,
                    status: matchedDriver ? 'driver_matched' : 'requested',
                    matchedAt: matchedDriver ? new Date() : undefined,
                    pickupLat: String(dto.pickupLat),
                    pickupLng: String(dto.pickupLng),
                    dropoffLat: String(dto.dropoffLat),
                    dropoffLng: String(dto.dropoffLng),
                    estimatedFare: String(estimate.estimatedFare),
                    estimatedDistanceKm: String(estimate.breakdown.distanceKm),
                    estimatedDurationMinutes: estimate.breakdown.estimatedMinutes,
                }),
            );
            await manager.save(
                OutboxEvent,
                manager.create(OutboxEvent, {
                    aggregateId: saved.id,
                    aggregateType: 'Ride',
                    eventType: ROUTING_KEYS.RIDE_REQUESTED,
                    payload: {
                        rideId: saved.id,
                        riderId: user.sub,
                        pickupLat: dto.pickupLat,
                        pickupLng: dto.pickupLng,
                        dropoffLat: dto.dropoffLat,
                        dropoffLng: dto.dropoffLng,
                        estimatedFare: estimate.estimatedFare,
                    },
                }),
            );
            if (matchedDriver) {
                await manager.save(
                    OutboxEvent,
                    manager.create(OutboxEvent, {
                        aggregateId: saved.id,
                        aggregateType: 'Ride',
                        eventType: ROUTING_KEYS.RIDE_DRIVER_MATCHED,
                        payload: {
                            rideId: saved.id,
                            riderId: user.sub,
                            driverId: matchedDriver.driverId,
                            driverName: `Driver ${matchedDriver.driverId.slice(0, 8)}`,
                            estimatedArrivalMinutes: Math.max(
                                1,
                                Math.ceil((matchedDriver.distanceKm / 30) * 60),
                            ),
                            pickupLat: dto.pickupLat,
                            pickupLng: dto.pickupLng,
                        },
                    }),
                );
            }
            return saved;
        });
        if (idempotencyKey)
            await this.redis.set(
                `idempotency:ride:${user.sub}:${idempotencyKey}`,
                JSON.stringify(ride),
                'EX',
                86400,
            );
        return ride;
    }

    async list(user: JwtPayload) {
        return this.rides.find({
            where: user.role === 'admin' ? {} : { riderId: user.sub },
            order: { requestedAt: 'DESC' },
        });
    }

    async get(id: string, user: JwtPayload) {
        const ride = await this.rides.findOne({ where: { id } });
        if (!ride) throw new NotFoundException('ride not found');
        if (user.role !== 'admin' && ride.riderId !== user.sub && ride.driverId !== user.sub)
            throw new ForbiddenException();
        return ride;
    }

    async match(id: string, dto: MatchRideDto, user: JwtPayload) {
        if (user.role !== 'driver') throw new ForbiddenException('driver role required');
        if (dto.driverId !== user.sub)
            throw new ForbiddenException('driverId must match authenticated driver');
        return this.transition(
            id,
            user,
            ['requested'],
            { status: 'driver_matched', driverId: dto.driverId, matchedAt: new Date() },
            ROUTING_KEYS.RIDE_DRIVER_MATCHED,
            {
                rideId: id,
                driverId: dto.driverId,
                driverName: dto.driverName,
                estimatedArrivalMinutes: dto.estimatedArrivalMinutes,
            },
        );
    }

    async arrive(id: string, user: JwtPayload) {
        if (user.role !== 'driver') throw new ForbiddenException('driver role required');
        return this.transition(
            id,
            user,
            ['driver_matched'],
            { status: 'driver_arrived' },
            ROUTING_KEYS.RIDE_STARTED,
            { rideId: id, driverId: user.sub, stage: 'driver_arrived' },
        );
    }

    async start(id: string, user: JwtPayload) {
        if (user.role !== 'driver') throw new ForbiddenException('driver role required');
        return this.transition(
            id,
            user,
            ['driver_arrived'],
            { status: 'in_progress', startedAt: new Date() },
            ROUTING_KEYS.RIDE_STARTED,
            { rideId: id, driverId: user.sub },
        );
    }

    async complete(id: string, dto: CompleteRideDto, user: JwtPayload) {
        if (user.role !== 'driver') throw new ForbiddenException('driver role required');
        return this.transition(
            id,
            user,
            ['in_progress'],
            {
                status: 'completed',
                completedAt: new Date(),
                finalFare: String(dto.finalFare),
                actualDistanceKm: String(dto.distanceKm),
                actualDurationMinutes: dto.durationMinutes,
            },
            ROUTING_KEYS.RIDE_COMPLETED,
            {
                rideId: id,
                driverId: user.sub,
                finalFare: dto.finalFare,
                distanceKm: dto.distanceKm,
                durationMinutes: dto.durationMinutes,
            },
        );
    }

    async cancel(id: string, dto: CancelRideDto, user?: JwtPayload) {
        const ride = await this.rides.findOne({ where: { id } });
        if (!ride) throw new NotFoundException('ride not found');
        if (ride.status === 'completed')
            throw new BadRequestException('completed ride cannot be cancelled');
        if (ride.status === 'cancelled') throw new BadRequestException('ride already cancelled');
        if (user) this.assertCanCancel(ride, dto, user);
        return this.transition(
            id,
            user,
            ['requested', 'driver_matched', 'driver_arrived', 'in_progress'],
            {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: dto.reason,
                cancelledBy: dto.cancelledBy,
            },
            ROUTING_KEYS.RIDE_CANCELLED,
            {
                rideId: id,
                riderId: ride.riderId,
                driverId: ride.driverId,
                reason: dto.reason,
                cancelledBy: dto.cancelledBy,
            },
        );
    }

    async paymentProcessed(payload: { rideId: string; finalFare: number }) {
        return this.dataSource.transaction(async (manager) => {
            const ride = await manager.findOne(Ride, { where: { id: payload.rideId } });
            if (!ride) throw new NotFoundException('ride not found');
            if (ride.status === 'completed') return ride;
            if (ride.status === 'cancelled')
                throw new BadRequestException('cancelled ride cannot be completed');
            if (!ride.driverId) throw new BadRequestException('cannot complete an unassigned ride');
            if (!['driver_matched', 'driver_arrived', 'in_progress'].includes(ride.status)) {
                throw new BadRequestException(`cannot transition ride from ${ride.status}`);
            }

            Object.assign(ride, {
                status: 'completed' as RideStatus,
                finalFare: String(payload.finalFare),
                completedAt: new Date(),
            });
            const saved = await manager.save(Ride, ride);
            await manager.save(
                OutboxEvent,
                manager.create(OutboxEvent, {
                    aggregateId: ride.id,
                    aggregateType: 'Ride',
                    eventType: ROUTING_KEYS.RIDE_COMPLETED,
                    payload: {
                        rideId: ride.id,
                        riderId: ride.riderId,
                        driverId: ride.driverId,
                        finalFare: payload.finalFare,
                        distanceKm: Number(ride.actualDistanceKm ?? ride.estimatedDistanceKm ?? 0),
                        durationMinutes:
                            ride.actualDurationMinutes ?? ride.estimatedDurationMinutes ?? 0,
                        pickupLat: Number(ride.pickupLat),
                        pickupLng: Number(ride.pickupLng),
                    },
                }),
            );
            return saved;
        });
    }

    async paymentFailed(payload: { rideId: string }) {
        await this.cancel(payload.rideId, { reason: 'payment_failed', cancelledBy: 'system' });
    }

    private async transition(
        id: string,
        user: JwtPayload | undefined,
        allowedStatuses: RideStatus[],
        updates: Partial<Ride>,
        eventType: string,
        payload: Record<string, unknown>,
    ) {
        return this.dataSource.transaction(async (manager) => {
            const ride = await manager.findOne(Ride, { where: { id } });
            if (!ride) throw new NotFoundException('ride not found');
            if (!allowedStatuses.includes(ride.status))
                throw new BadRequestException(`cannot transition ride from ${ride.status}`);
            if (user?.role === 'driver' && ride.driverId && ride.driverId !== user.sub)
                throw new ForbiddenException('ride is assigned to another driver');
            if (user?.role === 'rider' && ride.riderId !== user.sub)
                throw new ForbiddenException('ride belongs to another rider');
            Object.assign(ride, updates);
            const saved = await manager.save(Ride, ride);
            const enrichedPayload = {
                riderId: ride.riderId,
                driverId: ride.driverId,
                pickupLat: Number(ride.pickupLat),
                pickupLng: Number(ride.pickupLng),
                ...payload,
            };
            await manager.save(
                OutboxEvent,
                manager.create(OutboxEvent, {
                    aggregateId: id,
                    aggregateType: 'Ride',
                    eventType,
                    payload: enrichedPayload,
                }),
            );
            return saved;
        });
    }

    private assertCanCancel(ride: Ride, dto: CancelRideDto, user: JwtPayload): void {
        if (user.role === 'admin') return;
        if (dto.cancelledBy === 'system')
            throw new ForbiddenException('system cancellation is internal only');
        if (dto.cancelledBy !== user.role)
            throw new ForbiddenException('cancelledBy must match authenticated role');
        if (user.role === 'rider' && ride.riderId !== user.sub)
            throw new ForbiddenException('ride belongs to another rider');
        if (user.role === 'driver' && ride.driverId !== user.sub)
            throw new ForbiddenException('ride is assigned to another driver');
    }
}
