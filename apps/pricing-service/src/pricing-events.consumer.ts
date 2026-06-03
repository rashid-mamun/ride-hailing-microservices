import { Injectable, OnModuleInit } from '@nestjs/common';
import { EXCHANGES, ROUTING_KEYS, assertEventPayload } from '@ride-hailing/shared-events';
import { RabbitMqClient, createLogger } from '@ride-hailing/shared-utils';
import { PricingService } from './pricing.service';

@Injectable()
export class PricingEventsConsumer implements OnModuleInit {
    private readonly logger = createLogger('pricing-service');
    private readonly rabbit = new RabbitMqClient(process.env.RABBITMQ_URL || '', this.logger);
    constructor(private readonly pricingService: PricingService) {}
    async onModuleInit() {
        await this.rabbit.consume(
            EXCHANGES.RIDE,
            'pricing-service.surge',
            [ROUTING_KEYS.RIDE_REQUESTED, ROUTING_KEYS.RIDE_COMPLETED, ROUTING_KEYS.RIDE_CANCELLED],
            async (payload: { pickupLat?: number; pickupLng?: number }, message) => {
                assertEventPayload(message.fields.routingKey as never, payload);
                if (typeof payload.pickupLat !== 'number' || typeof payload.pickupLng !== 'number')
                    return;
                if (message.fields.routingKey === ROUTING_KEYS.RIDE_REQUESTED) {
                    await this.pricingService.incrementZone(payload.pickupLat, payload.pickupLng);
                    return;
                }
                await this.pricingService.decrementZone(payload.pickupLat, payload.pickupLng);
            },
        );
    }
}
