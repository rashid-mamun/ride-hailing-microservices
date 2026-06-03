import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { EXCHANGES } from '@ride-hailing/shared-events';
import { RabbitMqClient, createLogger } from '@ride-hailing/shared-utils';
import { OutboxEvent } from './entities/outbox-event.entity';

@Injectable()
export class OutboxPublisher implements OnModuleInit {
    private readonly logger = createLogger('ride-service');
    private readonly rabbit = new RabbitMqClient(process.env.RABBITMQ_URL || '', this.logger);
    constructor(@InjectRepository(OutboxEvent) private readonly outbox: Repository<OutboxEvent>) {}
    async onModuleInit() {
        await this.rabbit.connect();
    }
    @Cron(CronExpression.EVERY_5_SECONDS)
    async publishPending() {
        const events = await this.outbox.find({
            where: { status: 'pending', attempts: LessThan(3) },
            order: { createdAt: 'ASC' },
            take: 50,
        });
        for (const event of events) {
            try {
                await this.rabbit.publish(EXCHANGES.RIDE, event.eventType, event.payload);
                await this.outbox.update(event.id, {
                    status: 'published',
                    publishedAt: new Date(),
                });
            } catch {
                const attempts = event.attempts + 1;
                await this.outbox.update(event.id, {
                    attempts,
                    lastAttemptAt: new Date(),
                    status: attempts >= 3 ? 'failed' : 'pending',
                });
            }
        }
    }
}
