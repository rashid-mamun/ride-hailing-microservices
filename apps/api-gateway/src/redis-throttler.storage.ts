import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

export class RedisThrottlerStorage implements ThrottlerStorage {
    constructor(private readonly redis: Redis) {}

    async increment(
        key: string,
        ttl: number,
        limit: number,
        blockDuration: number,
        throttlerName: string,
    ): Promise<ThrottlerStorageRecord> {
        const namespacedKey = `throttle:${throttlerName}:${key}`;
        const totalHits = await this.redis.incr(namespacedKey);
        if (totalHits === 1) await this.redis.pexpire(namespacedKey, ttl);
        const timeToExpire = Math.max(await this.redis.pttl(namespacedKey), 0);
        const blockKey = `${namespacedKey}:blocked`;
        if (totalHits > limit) await this.redis.set(blockKey, '1', 'PX', blockDuration);
        const timeToBlockExpire = Math.max(await this.redis.pttl(blockKey), 0);
        return { totalHits, timeToExpire, isBlocked: timeToBlockExpire > 0, timeToBlockExpire };
    }
}
