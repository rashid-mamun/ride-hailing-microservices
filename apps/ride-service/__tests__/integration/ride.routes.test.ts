import { INestApplication, ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RideController } from '../../src/ride.controller';
import { RideService } from '../../src/ride.service';
import { JwtAuthGuard } from '../../src/jwt-auth.guard';

describe('Ride routes', () => {
    let app: INestApplication;
    const ride = { id: 'ride-1', status: 'requested', riderId: 'rider-1' };
    const rideService = {
        requestRide: jest.fn(),
        list: jest.fn(),
        get: jest.fn(),
        match: jest.fn(),
        arrive: jest.fn(),
        start: jest.fn(),
        complete: jest.fn(),
        cancel: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const moduleRef = await Test.createTestingModule({
            controllers: [RideController],
            providers: [{ provide: RideService, useValue: rideService }],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: ExecutionContext) => {
                    const request = context.switchToHttp().getRequest<{
                        method?: string;
                        path?: string;
                        user?: { sub: string; email: string; role: string };
                    }>();
                    const isDriverLifecycle = ['match', 'arrive', 'start', 'complete'].some(
                        (segment) => request.path?.includes(`/${segment}`),
                    );
                    request.user = isDriverLifecycle
                        ? {
                              sub: '11111111-1111-4111-8111-111111111111',
                              email: 'driver@example.com',
                              role: 'driver',
                          }
                        : { sub: 'rider-1', email: 'rider@example.com', role: 'rider' };
                    return true;
                },
            })
            .compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
        );
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('requests, lists and reads rides through HTTP', async () => {
        rideService.requestRide.mockResolvedValue(ride);
        rideService.list.mockResolvedValue([ride]);
        rideService.get.mockResolvedValue(ride);

        await request(app.getHttpServer())
            .post('/api/rides')
            .set('X-Idempotency-Key', 'idem-1')
            .send({
                pickupLat: 23.8103,
                pickupLng: 90.4125,
                pickupAddress: 'Gulshan',
                dropoffLat: 23.7461,
                dropoffLng: 90.3742,
                dropoffAddress: 'Dhanmondi',
            })
            .expect(201)
            .expect(({ body }) =>
                expect(body).toMatchObject({ success: true, data: { id: 'ride-1' } }),
            );

        expect(rideService.requestRide.mock.calls[0][2]).toBe('idem-1');

        await request(app.getHttpServer())
            .get('/api/rides')
            .expect(200)
            .expect(({ body }) => expect(body.data).toHaveLength(1));
        await request(app.getHttpServer())
            .get('/api/rides/ride-1')
            .expect(200)
            .expect(({ body }) => expect(body.data.id).toBe('ride-1'));
    });

    it('rejects invalid ride request DTOs', async () => {
        await request(app.getHttpServer())
            .post('/api/rides')
            .send({
                pickupLat: 999,
                pickupLng: 90.4125,
                pickupAddress: 'Gulshan',
                dropoffLat: 23.7461,
                dropoffLng: 90.3742,
                dropoffAddress: 'Dhanmondi',
            })
            .expect(400);

        expect(rideService.requestRide).not.toHaveBeenCalled();
    });

    it('transitions ride lifecycle routes and cancel route', async () => {
        rideService.match.mockResolvedValue({ ...ride, status: 'driver_matched' });
        rideService.arrive.mockResolvedValue({ ...ride, status: 'driver_arrived' });
        rideService.start.mockResolvedValue({ ...ride, status: 'in_progress' });
        rideService.complete.mockResolvedValue({ ...ride, status: 'completed' });
        rideService.cancel.mockResolvedValue({ ...ride, status: 'cancelled' });

        await request(app.getHttpServer())
            .patch('/api/rides/ride-1/match')
            .send({
                driverId: '11111111-1111-4111-8111-111111111111',
                driverName: 'Jane',
                estimatedArrivalMinutes: 5,
            })
            .expect(200)
            .expect(({ body }) => expect(body.data.status).toBe('driver_matched'));
        await request(app.getHttpServer())
            .patch('/api/rides/ride-1/arrive')
            .send()
            .expect(200)
            .expect(({ body }) => expect(body.data.status).toBe('driver_arrived'));
        await request(app.getHttpServer())
            .patch('/api/rides/ride-1/start')
            .send()
            .expect(200)
            .expect(({ body }) => expect(body.data.status).toBe('in_progress'));
        await request(app.getHttpServer())
            .patch('/api/rides/ride-1/complete')
            .send({ finalFare: 200, distanceKm: 9.5, durationMinutes: 25 })
            .expect(200)
            .expect(({ body }) => expect(body.data.status).toBe('completed'));
        await request(app.getHttpServer())
            .patch('/api/rides/ride-1/cancel')
            .send({ reason: 'changed_mind', cancelledBy: 'rider' })
            .expect(200)
            .expect(({ body }) => expect(body.data.status).toBe('cancelled'));
    });
});
