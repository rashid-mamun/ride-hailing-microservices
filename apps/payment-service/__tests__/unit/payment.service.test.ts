import { ROUTING_KEYS } from '@ride-hailing/shared-events';
import type { Repository } from 'typeorm';
import { Payment } from '../../src/entities/payment.entity';
import { PaymentService } from '../../src/payment.service';

const publish = jest.fn();

jest.mock('@ride-hailing/shared-utils', () => ({
    createLogger: () => ({ info: jest.fn(), error: jest.fn() }),
    RabbitMqClient: jest.fn().mockImplementation(() => ({ publish })),
}));

describe('PaymentService', () => {
    const repo = {
        findOne: jest.fn(),
        save: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.PAYMENT_FAILURE_RATE = '0';
        repo.findOne.mockResolvedValue(null);
        repo.save.mockImplementation(async (value: Record<string, unknown>) => ({
            id: 'payment-1',
            ...value,
        }));
    });

    it('records successful payments and publishes payment.processed', async () => {
        const service = new PaymentService(repo as unknown as Repository<Payment>);

        const payment = await service.processRideCompleted({
            rideId: '11111111-1111-4111-8111-111111111111',
            riderId: '22222222-2222-4222-8222-222222222222',
            driverId: '33333333-3333-4333-8333-333333333333',
            finalFare: 250,
            distanceKm: 10,
            durationMinutes: 20,
        });

        expect(payment.status).toBe('processed');
        expect(publish).toHaveBeenCalledWith(
            'ride.exchange',
            ROUTING_KEYS.PAYMENT_PROCESSED,
            expect.objectContaining({ finalFare: 250, transactionId: expect.any(String) }),
        );
    });

    it('publishes payment.failed when simulation fails', async () => {
        process.env.PAYMENT_FAILURE_RATE = '1';
        const service = new PaymentService(repo as unknown as Repository<Payment>);

        await service.processRideCompleted({
            rideId: '11111111-1111-4111-8111-111111111111',
            riderId: '22222222-2222-4222-8222-222222222222',
            driverId: '33333333-3333-4333-8333-333333333333',
            finalFare: 250,
            distanceKm: 10,
            durationMinutes: 20,
        });

        expect(publish).toHaveBeenCalledWith(
            'ride.exchange',
            ROUTING_KEYS.PAYMENT_FAILED,
            expect.objectContaining({ reason: 'simulated_payment_failure' }),
        );
    });

    it('rejects malformed ride completed events', async () => {
        const service = new PaymentService(repo as unknown as Repository<Payment>);

        await expect(service.processRideCompleted({ rideId: 'ride-1' } as never)).rejects.toThrow(
            'Invalid ride.completed payload',
        );
    });
});
