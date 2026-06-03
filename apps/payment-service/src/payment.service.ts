import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    EXCHANGES,
    ROUTING_KEYS,
    RideCompletedEvent,
    assertEventPayload,
} from '@ride-hailing/shared-events';
import { RabbitMqClient, createLogger } from '@ride-hailing/shared-utils';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentService {
    private readonly logger = createLogger('payment-service');
    private readonly rabbit = new RabbitMqClient(process.env.RABBITMQ_URL || '', this.logger);

    constructor(@InjectRepository(Payment) private readonly payments: Repository<Payment>) {}

    async processRideCompleted(payload: RideCompletedEvent): Promise<Payment> {
        assertEventPayload(ROUTING_KEYS.RIDE_COMPLETED, payload);

        const existing = await this.payments.findOne({
            where: { rideId: payload.rideId, status: 'processed' },
        });
        if (existing) return existing;

        const transactionId = `pay_${payload.rideId.replaceAll('-', '').slice(0, 18)}_${Date.now()}`;
        const shouldFail = Number(process.env.PAYMENT_FAILURE_RATE || 0) > Math.random();

        if (shouldFail) {
            const payment = await this.payments.save({
                rideId: payload.rideId,
                riderId: payload.riderId,
                driverId: payload.driverId,
                amount: String(payload.finalFare),
                transactionId,
                status: 'failed',
                failureReason: 'simulated_payment_failure',
            });
            await this.rabbit.publish(EXCHANGES.RIDE, ROUTING_KEYS.PAYMENT_FAILED, {
                rideId: payload.rideId,
                riderId: payload.riderId,
                driverId: payload.driverId,
                reason: payment.failureReason,
            });
            return payment;
        }

        const payment = await this.payments.save({
            rideId: payload.rideId,
            riderId: payload.riderId,
            driverId: payload.driverId,
            amount: String(payload.finalFare),
            transactionId,
            status: 'processed',
        });

        await this.rabbit.publish(EXCHANGES.RIDE, ROUTING_KEYS.PAYMENT_PROCESSED, {
            rideId: payload.rideId,
            riderId: payload.riderId,
            driverId: payload.driverId,
            finalFare: payload.finalFare,
            transactionId,
        });

        return payment;
    }
}
