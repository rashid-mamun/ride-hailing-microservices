import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ROUTING_KEYS } from '@ride-hailing/shared-events';
import type { DataSource, Repository } from 'typeorm';
import { Ride } from '../../src/entities/ride.entity';
import { PricingClient } from '../../src/pricing.client';
import { RideService } from '../../src/ride.service';

const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockRedis));

const rider = { sub: 'rider-1', email: 'rider@example.com', role: 'rider' as const };
const driver = { sub: 'driver-1', email: 'driver@example.com', role: 'driver' as const };

type RideRecord = {
    id: string;
    riderId: string;
    driverId?: string;
    status: string;
    pickupLat: string;
    pickupLng: string;
    dropoffLat: string;
    dropoffLng: string;
    estimatedFare: string;
} & Record<string, unknown>;

type TransactionManager = {
    create: jest.MockedFunction<(entity: unknown, value: unknown) => unknown>;
    save: jest.MockedFunction<
        (entity: { name?: string }, value: { id?: string }) => Promise<Record<string, unknown>>
    >;
    findOne: jest.MockedFunction<(entity: unknown, options: unknown) => Promise<RideRecord | null>>;
};

function ride(overrides: Partial<RideRecord> = {}): RideRecord {
    return {
        id: 'ride-1',
        riderId: 'rider-1',
        driverId: undefined,
        status: 'requested',
        pickupLat: '23.8103000',
        pickupLng: '90.4125000',
        dropoffLat: '23.7461000',
        dropoffLng: '90.3742000',
        estimatedFare: '185.00',
        ...overrides,
    } as RideRecord;
}

function createService(currentRide: RideRecord | null = ride()) {
    const manager: TransactionManager = {
        create: jest.fn<unknown, [unknown, unknown]>((_entity, value) => value),
        save: jest.fn<Promise<Record<string, unknown>>, [{ name?: string }, { id?: string }]>(
            async (entity, value) => {
                if (entity.name === 'Ride') return { id: value.id || 'ride-1', ...value };
                return { id: 'outbox-1', ...value };
            },
        ),
        findOne: jest.fn<Promise<RideRecord | null>, [unknown, unknown]>(async () => currentRide),
    };
    const dataSource = {
        transaction: jest.fn((fn: (manager: TransactionManager) => unknown) => fn(manager)),
    };
    const rides = {
        find: jest.fn(async () => [currentRide]),
        findOne: jest.fn(async () => currentRide),
        update: jest.fn(async () => ({ affected: 1 })),
    };
    const pricing = {
        estimate: jest.fn(async () => ({
            estimatedFare: 185,
            breakdown: { distanceKm: 8.1, estimatedMinutes: 17 },
        })),
    };
    return {
        service: new RideService(
            dataSource as unknown as DataSource,
            rides as unknown as Repository<Ride>,
            pricing as unknown as PricingClient,
        ),
        dataSource,
        rides,
        pricing,
        manager,
    };
}

describe('RideService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedis.get.mockResolvedValue(null);
        mockRedis.set.mockResolvedValue('OK');
    });

    it('creates ride and outbox event in one transaction with idempotency cache', async () => {
        const { service, dataSource, pricing, manager } = createService();

        const result = await service.requestRide(
            rider,
            {
                pickupLat: 23.8103,
                pickupLng: 90.4125,
                pickupAddress: 'Gulshan 1',
                dropoffLat: 23.7461,
                dropoffLng: 90.3742,
                dropoffAddress: 'Dhanmondi 27',
            },
            'idem-1',
        );

        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(pricing.estimate).toHaveBeenCalledWith({
            pickupLat: 23.8103,
            pickupLng: 90.4125,
            dropoffLat: 23.7461,
            dropoffLng: 90.3742,
        });
        expect(manager.save).toHaveBeenCalledTimes(2);
        expect(manager.save.mock.calls[1][1]).toMatchObject({
            aggregateType: 'Ride',
            eventType: ROUTING_KEYS.RIDE_REQUESTED,
            payload: expect.objectContaining({
                rideId: 'ride-1',
                riderId: 'rider-1',
                estimatedFare: 185,
            }),
        });
        expect(mockRedis.set).toHaveBeenCalledWith(
            'idempotency:ride:rider-1:idem-1',
            JSON.stringify(result),
            'EX',
            86400,
        );
    });

    it('returns cached idempotency response without creating duplicate ride', async () => {
        mockRedis.get.mockResolvedValueOnce(JSON.stringify({ id: 'ride-cached' }));
        const { service, dataSource, pricing } = createService();

        await expect(
            service.requestRide(
                rider,
                {
                    pickupLat: 1,
                    pickupLng: 2,
                    pickupAddress: 'A',
                    dropoffLat: 3,
                    dropoffLng: 4,
                    dropoffAddress: 'B',
                },
                'idem-1',
            ),
        ).resolves.toEqual({ id: 'ride-cached' });

        expect(pricing.estimate).not.toHaveBeenCalled();
        expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('allows only riders to request rides', async () => {
        const { service } = createService();

        await expect(
            service.requestRide(driver, {
                pickupLat: 1,
                pickupLng: 2,
                pickupAddress: 'A',
                dropoffLat: 3,
                dropoffLng: 4,
                dropoffAddress: 'B',
            }),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lists rides by role and enforces read access ownership', async () => {
        const assignedRide = ride({ driverId: 'driver-1' });
        const { service, rides } = createService(assignedRide);
        const admin = { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as const };

        await service.list(admin);
        expect(rides.find).toHaveBeenLastCalledWith({ where: {}, order: { requestedAt: 'DESC' } });

        await service.list(rider);
        expect(rides.find).toHaveBeenLastCalledWith({
            where: { riderId: 'rider-1' },
            order: { requestedAt: 'DESC' },
        });

        await expect(service.get('ride-1', rider)).resolves.toEqual(assignedRide);
        await expect(service.get('ride-1', driver)).resolves.toEqual(assignedRide);
        await expect(service.get('ride-1', admin)).resolves.toEqual(assignedRide);

        rides.findOne.mockResolvedValueOnce(null);
        await expect(service.get('missing', rider)).rejects.toBeInstanceOf(NotFoundException);

        rides.findOne.mockResolvedValueOnce(ride({ riderId: 'rider-2', driverId: 'driver-2' }));
        await expect(service.get('ride-2', rider)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('matches a requested ride to the authenticated driver and emits outbox event', async () => {
        const { service, manager } = createService(ride());

        const result = await service.match(
            'ride-1',
            { driverId: 'driver-1', driverName: 'Jane', estimatedArrivalMinutes: 4 },
            driver,
        );

        expect(result.status).toBe('driver_matched');
        expect(result.driverId).toBe('driver-1');
        expect(manager.save.mock.calls[1][1]).toMatchObject({
            eventType: ROUTING_KEYS.RIDE_DRIVER_MATCHED,
            payload: expect.objectContaining({ driverName: 'Jane', estimatedArrivalMinutes: 4 }),
        });
    });

    it('rejects driver mismatch, invalid match status and missing ride', async () => {
        await expect(
            createService().service.match(
                'ride-1',
                { driverId: 'other-driver', driverName: 'X', estimatedArrivalMinutes: 5 },
                driver,
            ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
            createService(ride({ status: 'in_progress' })).service.match(
                'ride-1',
                { driverId: 'driver-1', driverName: 'Jane', estimatedArrivalMinutes: 5 },
                driver,
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
            createService(null).service.match(
                'ride-1',
                { driverId: 'driver-1', driverName: 'Jane', estimatedArrivalMinutes: 5 },
                driver,
            ),
        ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('enforces arrive, start and complete transition order', async () => {
        await expect(
            createService(ride({ status: 'driver_matched', driverId: 'driver-1' })).service.arrive(
                'ride-1',
                driver,
            ),
        ).resolves.toMatchObject({ status: 'driver_arrived' });
        await expect(
            createService(ride({ status: 'driver_arrived', driverId: 'driver-1' })).service.start(
                'ride-1',
                driver,
            ),
        ).resolves.toMatchObject({ status: 'in_progress' });
        await expect(
            createService(ride({ status: 'in_progress', driverId: 'driver-1' })).service.complete(
                'ride-1',
                { finalFare: 200, distanceKm: 9, durationMinutes: 20 },
                driver,
            ),
        ).resolves.toMatchObject({ status: 'completed', finalFare: '200' });
        await expect(
            createService(ride({ status: 'requested' })).service.start('ride-1', driver),
        ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('prevents other drivers from mutating an assigned ride', async () => {
        await expect(
            createService(ride({ status: 'driver_matched', driverId: 'driver-2' })).service.arrive(
                'ride-1',
                driver,
            ),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('cancels active rides only by the correct actor and emits outbox event', async () => {
        const { service, manager } = createService(
            ride({ status: 'driver_matched', driverId: 'driver-1' }),
        );

        await expect(
            service.cancel('ride-1', { reason: 'changed_mind', cancelledBy: 'rider' }, rider),
        ).resolves.toMatchObject({ status: 'cancelled' });
        expect(manager.save.mock.calls[1][1]).toMatchObject({
            eventType: ROUTING_KEYS.RIDE_CANCELLED,
            payload: expect.objectContaining({ reason: 'changed_mind', cancelledBy: 'rider' }),
        });
    });

    it('rejects cancelling completed, already cancelled, wrong actor or system cancellation by user', async () => {
        await expect(
            createService(ride({ status: 'completed' })).service.cancel(
                'ride-1',
                { reason: 'late', cancelledBy: 'rider' },
                rider,
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
            createService(ride({ status: 'cancelled' })).service.cancel(
                'ride-1',
                { reason: 'late', cancelledBy: 'rider' },
                rider,
            ),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(
            createService(ride({ status: 'requested', riderId: 'rider-2' })).service.cancel(
                'ride-1',
                { reason: 'late', cancelledBy: 'rider' },
                rider,
            ),
        ).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
            createService(ride({ status: 'requested' })).service.cancel(
                'ride-1',
                { reason: 'internal', cancelledBy: 'system' },
                rider,
            ),
        ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('updates rides from payment events', async () => {
        const { service, rides, dataSource, manager } = createService(
            ride({
                status: 'in_progress',
                driverId: 'driver-1',
                estimatedDistanceKm: '8.1',
                estimatedDurationMinutes: 17,
            }),
        );

        await service.paymentProcessed({ rideId: 'ride-1', finalFare: 230 });
        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
        expect(manager.save.mock.calls[0][1]).toMatchObject({
            status: 'completed',
            finalFare: '230',
        });
        expect(manager.save.mock.calls[1][1]).toMatchObject({
            eventType: ROUTING_KEYS.RIDE_COMPLETED,
            payload: expect.objectContaining({
                rideId: 'ride-1',
                riderId: 'rider-1',
                driverId: 'driver-1',
                finalFare: 230,
                distanceKm: 8.1,
                durationMinutes: 17,
            }),
        });
        expect(rides.update).not.toHaveBeenCalled();

        const failedPayment = createService(ride({ status: 'in_progress', driverId: 'driver-1' }));
        await failedPayment.service.paymentFailed({ rideId: 'ride-1' });
        expect(failedPayment.rides.findOne).toHaveBeenCalledWith({ where: { id: 'ride-1' } });
    });
});
