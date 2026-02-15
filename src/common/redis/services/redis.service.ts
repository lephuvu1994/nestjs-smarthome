import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
    constructor(@Inject('REDIS_CLIENT') private readonly redisClient: Redis) {}

    onModuleDestroy() {
        this.redisClient.disconnect();
    }

    // --- BASIC STRING (Dùng cho Status Online/Offline) ---

    async get(key: string): Promise<string | null> {
        return await this.redisClient.get(key);
    }

    async set(
        key: string,
        value: string | number,
        ttl?: number
    ): Promise<string> {
        const finalValue = String(value);
        if (ttl) {
            return await this.redisClient.set(key, finalValue, 'EX', ttl);
        }
        return await this.redisClient.set(key, finalValue);
    }

    // --- HASH (Dùng cho Device Shadow / Telemetry) ---

    /**
     * [UPDATE] Lưu một Object nhiều trường vào Redis Hash
     * Ví dụ: hmset('shadow:token', { temp: 25, hum: 60, status: 'ON' })
     */
    async hmset(key: string, data: Record<string, any>): Promise<number> {
        // Redis không lưu được Nested Object, ta cần convert value sang string
        const processedData: Record<string, string | number> = {};

        for (const [field, value] of Object.entries(data)) {
            // Nếu value là object (VD: màu sắc {r,g,b}), stringify nó
            if (typeof value === 'object' && value !== null) {
                processedData[field] = JSON.stringify(value);
            } else {
                // Giữ nguyên số hoặc string
                processedData[field] = value as string | number;
            }
        }

        // ioredis hỗ trợ truyền object vào hset (tương đương hmset cũ)
        return await this.redisClient.hset(key, processedData);
    }

    /**
     * Lưu lẻ 1 trường (Giữ nguyên cái cũ của bạn)
     */
    async hset(key: string, field: string, value: any): Promise<number> {
        const finalValue =
            typeof value === 'object' ? JSON.stringify(value) : String(value);
        return await this.redisClient.hset(key, field, finalValue);
    }

    async hget(key: string, field: string): Promise<string | null> {
        return await this.redisClient.hget(key, field);
    }

    /**
     * [UPDATE] Lấy toàn bộ Hash về
     */
    async hgetall(key: string): Promise<Record<string, string>> {
        return await this.redisClient.hgetall(key);
    }

    // --- UTILS ---

    async del(key: string): Promise<number> {
        return await this.redisClient.del(key);
    }

    /**
     * Set thời gian hết hạn cho Key (nếu cần)
     */
    async expire(key: string, seconds: number): Promise<number> {
        return await this.redisClient.expire(key, seconds);
    }
}
