import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from 'src/common/redis/services/redis.service';
import Redis from 'ioredis';

describe('RedisService', () => {
    let service: RedisService;
    let redisClientMock: any;

    beforeEach(async () => {
        // 1. Mock thư viện ioredis
        redisClientMock = {
            get: jest.fn(),
            set: jest.fn(),
            hset: jest.fn(),
            hget: jest.fn(),
            hgetall: jest.fn(),
            del: jest.fn(),
            disconnect: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RedisService,
                {
                    provide: 'REDIS_CLIENT',
                    useValue: redisClientMock,
                },
            ],
        }).compile();

        service = module.get<RedisService>(RedisService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleDestroy', () => {
        it('should disconnect redis client', () => {
            service.onModuleDestroy();
            expect(redisClientMock.disconnect).toHaveBeenCalled();
        });
    });

    describe('String Operations (get/set)', () => {
        it('should get a value by key', async () => {
            redisClientMock.get.mockResolvedValue('online');
            const result = await service.get('status:dev-1');

            expect(result).toBe('online');
            expect(redisClientMock.get).toHaveBeenCalledWith('status:dev-1');
        });

        it('should set a value without TTL', async () => {
            await service.set('key', 'value');
            expect(redisClientMock.set).toHaveBeenCalledWith('key', 'value');
        });

        it('should set a value with TTL (EX)', async () => {
            await service.set('key', 'value', 60);
            expect(redisClientMock.set).toHaveBeenCalledWith(
                'key',
                'value',
                'EX',
                60
            );
        });
    });

    describe('Hash Operations (hset/hget/hgetall)', () => {
        it('should hset a string value', async () => {
            await service.hset('shadow:dev', 'power', 1);
            // Code của bạn ép kiểu String(value)
            expect(redisClientMock.hset).toHaveBeenCalledWith(
                'shadow:dev',
                'power',
                '1'
            );
        });

        it('should hset an object by stringifying it', async () => {
            const complexValue = { status: 'ok', level: 50 };
            await service.hset('shadow:dev', 'meta', complexValue);

            expect(redisClientMock.hset).toHaveBeenCalledWith(
                'shadow:dev',
                'meta',
                JSON.stringify(complexValue)
            );
        });

        it('should hget a field value', async () => {
            redisClientMock.hget.mockResolvedValue('1');
            const result = await service.hget('shadow:dev', 'power');

            expect(result).toBe('1');
            expect(redisClientMock.hget).toHaveBeenCalledWith(
                'shadow:dev',
                'power'
            );
        });

        it('should return all fields with hgetall', async () => {
            const mockData = { power: '1', mode: 'auto' };
            redisClientMock.hgetall.mockResolvedValue(mockData);

            const result = await service.hgetall('shadow:dev');

            expect(result).toEqual(mockData);
            expect(redisClientMock.hgetall).toHaveBeenCalledWith('shadow:dev');
        });
    });

    describe('Delete Operation', () => {
        it('should delete a key', async () => {
            redisClientMock.del.mockResolvedValue(1);
            const result = await service.del('test-key');

            expect(result).toBe(1);
            expect(redisClientMock.del).toHaveBeenCalledWith('test-key');
        });
    });
});
