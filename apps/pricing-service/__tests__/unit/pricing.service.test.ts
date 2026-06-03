import { ForbiddenException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { PricingRule } from '../../src/pricing-rule.entity';
import { PricingService } from '../../src/pricing.service';

const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    incr: jest.fn(),
    decr: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockRedis));

const activeRule = {
    id: 'rule-1',
    name: 'Default',
    baseFare: '30',
    perKmRate: '12',
    perMinuteRate: '1.5',
    minimumFare: '50',
    surgeMultiplier: '1',
    isActive: true,
};

function createService(rule = activeRule) {
    const rules = {
        exists: jest.fn(async () => true),
        save: jest.fn(async (value) => ({ id: 'rule-new', ...value })),
        findOneByOrFail: jest.fn(async () => rule),
        find: jest.fn(async () => [rule]),
    };
    return { service: new PricingService(rules as unknown as Repository<PricingRule>), rules };
}

describe('PricingService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRedis.get.mockResolvedValue(null);
        mockRedis.set.mockResolvedValue('OK');
        mockRedis.incr.mockResolvedValue(1);
        mockRedis.decr.mockResolvedValue(0);
        process.env.SURGE_THRESHOLD_1 = '50';
        process.env.SURGE_THRESHOLD_2 = '100';
    });

    it('seeds a default rule when no active rule exists', async () => {
        const { service, rules } = createService();
        rules.exists.mockResolvedValueOnce(false);

        await service.onModuleInit();

        expect(rules.save).toHaveBeenCalledWith({ name: 'Default Dhaka Rule' });
    });

    it('calculates Haversine distance for known Dhaka coordinates', () => {
        const { service } = createService();

        expect(service.haversine(23.8103, 90.4125, 23.7461, 90.3742)).toBeCloseTo(8.11, 1);
    });

    it('calculates fare, rounds to nearest 5 BDT and caches result', async () => {
        const { service, rules } = createService();

        const result = await service.estimate({
            pickupLat: 23.8103,
            pickupLng: 90.4125,
            dropoffLat: 23.7461,
            dropoffLng: 90.3742,
        });

        expect(result).toMatchObject({
            estimatedFare: 155,
            currency: 'BDT',
            breakdown: expect.objectContaining({
                baseFare: 30,
                surgeMultiplier: 1,
                estimatedMinutes: 17,
            }),
        });
        expect(rules.findOneByOrFail).toHaveBeenCalledTimes(1);
        expect(mockRedis.set).toHaveBeenCalledWith(
            'fare:23.81030,90.41250,23.74610,90.37420',
            JSON.stringify(result),
            'EX',
            120,
        );
    });

    it('returns cached fare without database access', async () => {
        const cached = { estimatedFare: 185, breakdown: { distanceKm: 8.1 }, currency: 'BDT' };
        mockRedis.get.mockResolvedValueOnce(JSON.stringify(cached));
        const { service, rules } = createService();

        await expect(
            service.estimate({ pickupLat: 1, pickupLng: 2, dropoffLat: 3, dropoffLng: 4 }),
        ).resolves.toEqual(cached);
        expect(rules.findOneByOrFail).not.toHaveBeenCalled();
    });

    it('applies surge multipliers at configured demand thresholds', async () => {
        mockRedis.get.mockImplementation(async (key: string) =>
            key.includes('active_rides') ? '101' : null,
        );
        const { service } = createService();

        const result = await service.estimate({
            pickupLat: 23.8103,
            pickupLng: 90.4125,
            dropoffLat: 23.7461,
            dropoffLng: 90.3742,
        });

        expect(result.breakdown.surgeMultiplier).toBe(2);
        expect(result.estimatedFare).toBe(305);
    });

    it('allows only admins to list or create pricing rules', async () => {
        const { service, rules } = createService();
        const admin = { sub: 'admin-1', email: 'admin@example.com', role: 'admin' as const };
        const rider = { sub: 'rider-1', email: 'rider@example.com', role: 'rider' as const };

        await expect(service.listRules(admin)).resolves.toEqual([activeRule]);
        await expect(
            service.createRule(admin, {
                name: 'Night',
                baseFare: 40,
                perKmRate: 15,
                perMinuteRate: 2,
                minimumFare: 60,
                surgeMultiplier: 1.2,
            }),
        ).resolves.toMatchObject({ name: 'Night', baseFare: '40' });
        await expect(service.listRules(rider)).rejects.toBeInstanceOf(ForbiddenException);
        await expect(
            service.createRule(rider, {
                name: 'Bad',
                baseFare: 1,
                perKmRate: 1,
                perMinuteRate: 1,
                minimumFare: 1,
                surgeMultiplier: 1,
            }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(rules.save).toHaveBeenCalledWith(
            expect.objectContaining({ surgeMultiplier: '1.2' }),
        );
    });

    it('increments and safely decrements active ride counters', async () => {
        const { service } = createService();

        await service.incrementZone(23.8103, 90.4125);
        expect(mockRedis.incr).toHaveBeenCalledWith('zone:23.81:90.41:active_rides');

        mockRedis.decr.mockResolvedValueOnce(-1);
        await service.decrementZone(23.8103, 90.4125);
        expect(mockRedis.set).toHaveBeenCalledWith('zone:23.81:90.41:active_rides', '0');
    });
});
