import { Injectable, OnModuleInit } from '@nestjs/common';
import { EXCHANGES, ROUTING_KEYS, assertEventPayload } from '@ride-hailing/shared-events';
import { RabbitMqClient, createLogger } from '@ride-hailing/shared-utils';
import { EmailService } from './email.service';

@Injectable()
export class NotificationConsumer implements OnModuleInit {
    private readonly logger = createLogger('notification-service');
    private readonly rabbit = new RabbitMqClient(process.env.RABBITMQ_URL || '', this.logger);
    constructor(private readonly email: EmailService) {}
    async onModuleInit() {
        await this.rabbit.consume(
            EXCHANGES.RIDE,
            'notification-service.email',
            [
                ROUTING_KEYS.RIDE_REQUESTED,
                ROUTING_KEYS.RIDE_DRIVER_MATCHED,
                ROUTING_KEYS.RIDE_COMPLETED,
                ROUTING_KEYS.RIDE_CANCELLED,
                ROUTING_KEYS.PAYMENT_FAILED,
            ],
            async (payload: Record<string, unknown>, message) => {
                try {
                    const routingKey = message.fields.routingKey;
                    assertEventPayload(routingKey as never, payload);
                    const template = routingKey.replaceAll('.', '_');
                    await this.email.send(
                        String(payload.to || payload.riderEmail || 'rider@example.com'),
                        this.subject(routingKey),
                        template,
                        payload,
                    );
                } catch (error) {
                    this.logger.error('email_send_failed', {
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            },
        );
    }
    private subject(key: string) {
        return (
            {
                [ROUTING_KEYS.RIDE_REQUESTED]: 'Ride requested',
                [ROUTING_KEYS.RIDE_DRIVER_MATCHED]: 'Driver matched',
                [ROUTING_KEYS.RIDE_COMPLETED]: 'Ride completed',
                [ROUTING_KEYS.RIDE_CANCELLED]: 'Ride cancelled',
                [ROUTING_KEYS.PAYMENT_FAILED]: 'Payment failed',
            }[key] || 'Ride update'
        );
    }
}
