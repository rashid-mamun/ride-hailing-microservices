import { Injectable, OnModuleInit } from '@nestjs/common';
import { EXCHANGES, ROUTING_KEYS, RideCompletedEvent } from '@ride-hailing/shared-events';
import { RabbitMqClient, createLogger } from '@ride-hailing/shared-utils';
import { PaymentService } from './payment.service';

@Injectable()
export class PaymentEventsConsumer implements OnModuleInit {
    private readonly logger = createLogger('payment-service');
    private readonly rabbit = new RabbitMqClient(process.env.RABBITMQ_URL || '', this.logger);

    constructor(private readonly paymentService: PaymentService) {}

    async onModuleInit() {
        await this.rabbit.consume<RideCompletedEvent>(
            EXCHANGES.RIDE,
            'payment-service.ride-completed',
            [ROUTING_KEYS.RIDE_COMPLETED],
            async (payload) => {
                await this.paymentService.processRideCompleted(payload);
            },
        );
    }
}
