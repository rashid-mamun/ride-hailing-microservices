import { Injectable, OnModuleInit } from '@nestjs/common';
import { EXCHANGES, ROUTING_KEYS, assertEventPayload } from '@ride-hailing/shared-events';
import { RabbitMqClient, createLogger } from '@ride-hailing/shared-utils';
import { RideService } from './ride.service';

@Injectable()
export class RideEventConsumer implements OnModuleInit {
    private readonly logger = createLogger('ride-service');
    private readonly rabbit = new RabbitMqClient(process.env.RABBITMQ_URL || '', this.logger);
    constructor(private readonly rideService: RideService) {}
    async onModuleInit() {
        await this.rabbit.consume(
            EXCHANGES.RIDE,
            'ride-service.payments',
            [ROUTING_KEYS.PAYMENT_PROCESSED, ROUTING_KEYS.PAYMENT_FAILED],
            async (payload: { rideId: string; finalFare?: number }, message) => {
                assertEventPayload(message.fields.routingKey as never, payload);
                if (message.fields.routingKey === ROUTING_KEYS.PAYMENT_PROCESSED)
                    await this.rideService.paymentProcessed({
                        rideId: payload.rideId,
                        finalFare: payload.finalFare || 0,
                    });
                if (message.fields.routingKey === ROUTING_KEYS.PAYMENT_FAILED)
                    await this.rideService.paymentFailed({ rideId: payload.rideId });
            },
        );
    }
}
