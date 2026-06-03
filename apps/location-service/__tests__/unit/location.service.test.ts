import { LocationService } from '../../src/location.service';

const mockRedis = {
    geoadd: jest.fn(),
    hset: jest.fn(),
    expire: jest.fn(),
    call: jest.fn(),
    hgetall: jest.fn(),
    zrange: jest.fn(),
    ttl: jest.fn(),
    zrem: jest.fn(),
};

jest.mock('ioredis', () => jest.fn(() => mockRedis));

describe('LocationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('updates driver GEO position and metadata with TTL', async () => {
        const service = new LocationService();

        await expect(
            service.updateDriverLocation('driver-1', {
                lat: 23.8103,
                lng: 90.4125,
                heading: 45.5,
                speed: 32.5,
                rideId: 'ride-1',
            }),
        ).resolves.toMatchObject({ driverId: 'driver-1' });

        expect(mockRedis.geoadd).toHaveBeenCalledWith(
            'drivers:available',
            90.4125,
            23.8103,
            'driver-1',
        );
        expect(mockRedis.hset).toHaveBeenCalledWith(
            'driver:driver-1:meta',
            expect.objectContaining({
                lat: 23.8103,
                lng: 90.4125,
                heading: 45.5,
                speed: 32.5,
                rideId: 'ride-1',
            }),
        );
        expect(mockRedis.expire).toHaveBeenCalledWith('driver:driver-1:meta', 30);
    });

    it('maps nearby GEOSEARCH rows to driver responses', async () => {
        const service = new LocationService();
        mockRedis.call.mockResolvedValueOnce([
            ['driver-1', '1.23'],
            ['driver-2', '2.34'],
        ]);
        mockRedis.hgetall
            .mockResolvedValueOnce({ lat: '23.8103', lng: '90.4125', heading: '45', speed: '30' })
            .mockResolvedValueOnce({ lat: '23.8110', lng: '90.4130', heading: '90', speed: '20' });

        await expect(
            service.nearby({ lat: 23.8103, lng: 90.4125, radiusKm: 5, limit: 10 }),
        ).resolves.toEqual([
            {
                driverId: 'driver-1',
                lat: 23.8103,
                lng: 90.4125,
                distanceKm: 1.23,
                heading: 45,
                speed: 30,
            },
            {
                driverId: 'driver-2',
                lat: 23.811,
                lng: 90.413,
                distanceKm: 2.34,
                heading: 90,
                speed: 20,
            },
        ]);

        expect(mockRedis.call).toHaveBeenCalledWith(
            'GEOSEARCH',
            'drivers:available',
            'FROMLONLAT',
            90.4125,
            23.8103,
            'BYRADIUS',
            5,
            'km',
            'ASC',
            'COUNT',
            10,
            'WITHDIST',
        );
    });

    it('filters stale GEO members whose metadata expired', async () => {
        const service = new LocationService();
        mockRedis.call.mockResolvedValueOnce([
            ['driver-1', '1.23'],
            ['driver-stale', '2.00'],
        ]);
        mockRedis.hgetall
            .mockResolvedValueOnce({ lat: '23.8103', lng: '90.4125', heading: '45', speed: '30' })
            .mockResolvedValueOnce({});

        await expect(
            service.nearby({ lat: 23.8103, lng: 90.4125, radiusKm: 5, limit: 10 }),
        ).resolves.toEqual([
            {
                driverId: 'driver-1',
                lat: 23.8103,
                lng: 90.4125,
                distanceKm: 1.23,
                heading: 45,
                speed: 30,
            },
        ]);
    });

    it('returns an empty list when no drivers are nearby', async () => {
        const service = new LocationService();
        mockRedis.call.mockResolvedValueOnce([]);

        await expect(
            service.nearby({ lat: 23.8103, lng: 90.4125, radiusKm: 5, limit: 10 }),
        ).resolves.toEqual([]);
    });

    it('removes offline drivers whose metadata key is missing', async () => {
        const service = new LocationService();
        mockRedis.zrange.mockResolvedValueOnce(['driver-1', 'driver-2']);
        mockRedis.ttl.mockResolvedValueOnce(20).mockResolvedValueOnce(-2);

        await service.cleanupOfflineDrivers();

        expect(mockRedis.zrem).toHaveBeenCalledTimes(1);
        expect(mockRedis.zrem).toHaveBeenCalledWith('drivers:available', 'driver-2');
    });
});
