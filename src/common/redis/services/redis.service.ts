import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

    onModuleDestroy() {
        this.redisClient.disconnect();
    }

    /**
     * Lấy giá trị String (Dùng cho check status online/offline)
     */
    async get(key: string): Promise<string | null> {
        return await this.redisClient.get(key);
    }

    /**
     * Lưu giá trị String với TTL (Dùng cho Heartbeat/Ping)
     */
    async set(key: string, value: string, ttl?: number): Promise<string> {
        if (ttl) {
            return await this.redisClient.set(key, value, 'EX', ttl);
        }
        return await this.redisClient.set(key, value);
    }

    /**
     * Lưu Hash (Dùng cho Device Shadow: Desired/Reported state)
     */
    async hset(key: string, field: string, value: any): Promise<number> {
        // Chuyển value sang string nếu nó là object để tiết kiệm và tránh lỗi [object Object]
        const finalValue =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
        return await this.redisClient.hset(key, field, finalValue);
    }

    /**
     * Lấy giá trị từ Hash (Lấy trạng thái thiết bị)
     */
    async hget(key: string, field: string): Promise<string | null> {
        return await this.redisClient.hget(key, field);
    }

    /**
     * Lấy toàn bộ Hash (Lấy full trạng thái thiết bị)
     */
    async hgetall(key: string): Promise<Record<string, string>> {
        return await this.redisClient.hgetall(key);
    }

    /**
     * Xóa Key
     */
    async del(key: string): Promise<number> {
        return await this.redisClient.del(key);
    }
}
