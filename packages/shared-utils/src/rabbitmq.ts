import amqp, { Channel, ChannelModel, ConsumeMessage, Options } from 'amqplib';

export type ConsumerHandler<T> = (
    payload: T,
    message: ConsumeMessage,
    channel: Channel,
) => Promise<void>;

export class RabbitMqClient {
    private connection?: ChannelModel;
    private channel?: Channel;
    private connecting?: Promise<Channel>;

    constructor(
        private readonly url: string,
        private readonly logger: {
            info: (m: string, meta?: object) => void;
            error: (m: string, meta?: object) => void;
        },
    ) {}

    async connect(retries = 10): Promise<Channel> {
        if (this.channel) return this.channel;
        if (this.connecting) return this.connecting;
        this.connecting = this.doConnect(retries);
        return this.connecting;
    }

    private async doConnect(retries: number): Promise<Channel> {
        let attempt = 0;
        while (attempt < retries) {
            try {
                this.connection = await amqp.connect(this.url);
                this.connection.on('close', () => {
                    this.channel = undefined;
                    this.connection = undefined;
                });
                this.connection.on('error', (error) =>
                    this.logger.error('rabbitmq_connection_error', { error: error.message }),
                );
                const connection = this.connection;
                this.channel = await connection.createChannel();
                this.logger.info('rabbitmq_connected');
                return this.channel;
            } catch (error) {
                attempt += 1;
                const delay = Math.min(30000, 500 * 2 ** attempt);
                this.logger.error('rabbitmq_connect_failed', {
                    attempt,
                    error: error instanceof Error ? error.message : String(error),
                });
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        throw new Error('RabbitMQ connection failed after maximum retries');
    }

    async publish(
        exchange: string,
        routingKey: string,
        payload: unknown,
        options: Options.Publish = {},
    ): Promise<boolean> {
        const channel = await this.connect();
        await channel.assertExchange(exchange, 'topic', { durable: true });
        return channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), {
            persistent: true,
            contentType: 'application/json',
            ...options,
        });
    }

    async consume<T>(
        exchange: string,
        queue: string,
        routingKeys: string[],
        handler: ConsumerHandler<T>,
    ): Promise<void> {
        const channel = await this.connect();
        await channel.assertExchange(exchange, 'topic', { durable: true });
        await channel.assertExchange(`${exchange}.dlx`, 'topic', { durable: true });
        await channel.assertExchange(`${exchange}.retry`, 'topic', { durable: true });
        await channel.assertQueue(`${queue}.dlq`, { durable: true });
        await channel.bindQueue(`${queue}.dlq`, `${exchange}.dlx`, '#');
        await channel.assertQueue(`${queue}.retry`, {
            durable: true,
            deadLetterExchange: exchange,
            messageTtl: 5000,
        });
        await channel.bindQueue(`${queue}.retry`, `${exchange}.retry`, '#');
        await channel.assertQueue(queue, { durable: true, deadLetterExchange: `${exchange}.dlx` });
        for (const key of routingKeys) await channel.bindQueue(queue, exchange, key);
        await channel.consume(queue, async (message) => {
            if (!message) return;
            try {
                const payload = JSON.parse(message.content.toString()) as T;
                await handler(payload, message, channel);
                channel.ack(message);
            } catch (error) {
                const infraError =
                    error instanceof Error &&
                    ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].some((code) =>
                        error.message.includes(code),
                    );
                if (!infraError) {
                    channel.ack(message);
                    return;
                }

                const retryCount = Number(message.properties.headers?.['x-retry-count'] ?? 0);
                if (retryCount >= 2) {
                    channel.nack(message, false, false);
                    return;
                }

                channel.publish(`${exchange}.retry`, message.fields.routingKey, message.content, {
                    persistent: true,
                    contentType: message.properties.contentType || 'application/json',
                    headers: { ...message.properties.headers, 'x-retry-count': retryCount + 1 },
                });
                channel.ack(message);
            }
        });
    }
}
