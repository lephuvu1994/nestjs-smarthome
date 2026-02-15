import { Test, TestingModule } from '@nestjs/testing';
import { MqttService } from 'src/common/mqtt/mqtt.service';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';

// Mock thư viện mqtt để không tạo kết nối thật
jest.mock('mqtt', () => ({
    connect: jest.fn().mockReturnValue({
        on: jest.fn(),
        subscribe: jest.fn(),
        publish: jest.fn(),
        end: jest.fn(),
    }),
}));

describe('MqttService', () => {
    let service: MqttService;

    const mockConfigService = {
        get: jest.fn((key: string) => {
            // ✅ Đảm bảo URL có protocol mqtt://
            if (key === 'MQTT_HOST') return 'mqtt://localhost';
            if (key === 'MQTT_PORT') return 1883;
            if (key === 'MQTT_USERNAME') return 'user';
            if (key === 'MQTT_PASSWORD') return 'pass';
            return null;
        }),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                MqttService,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        }).compile();

        service = module.get<MqttService>(MqttService);
    });

    it('nên khởi tạo và kết nối thành công (Phủ nhánh connect)', () => {
        // Gọi hàm kết nối của bạn (thường nằm trong onModuleInit hoặc constructor)
        // Nếu code của bạn tự gọi connect trong constructor thì dòng này có thể bỏ qua
        (service as any).connect();

        expect(mqtt.connect).toHaveBeenCalledWith(
            'mqtt://localhost',
            expect.objectContaining({ port: 1883 })
        );
        expect(service).toBeDefined();
    });

    it('nên phủ hàm subscribe và publish', () => {
        // Giả lập đã có this.client
        (service as any).client = (mqtt.connect as jest.Mock)();

        service.subscribe('test/topic', () => {});
        service.publish('test/topic', { data: 1 });

        expect((service as any).client.subscribe).toHaveBeenCalled();
        expect((service as any).client.publish).toHaveBeenCalled();
    });
    it('nên phủ các hàm Lifecycle của NestJS', async () => {
        const connectSpy = jest
            .spyOn(service as any, 'connect')
            .mockImplementation();
        const disconnectSpy = jest
            .spyOn(service as any, 'disconnect')
            .mockImplementation();

        // Gọi onModuleInit để phủ hàm connect()
        service.onModuleInit();
        expect(connectSpy).toHaveBeenCalled();

        // Gọi onModuleDestroy để phủ hàm disconnect()
        service.onModuleDestroy();
        expect(disconnectSpy).toHaveBeenCalled();
    });
    it('nên phủ nhánh lỗi khi Publish thất bại', async () => {
        const mockClient = {
            publish: jest.fn((topic, payload, options, callback) => {
                // Giả lập lỗi từ thư viện mqtt
                callback(new Error('Publish Error'));
            }),
        };
        (service as any).client = mockClient;

        // Phủ nhánh logic error logger và reject(err)
        await expect(service.publish('test', {})).rejects.toThrow(
            'Publish Error'
        );
    });
    it('nên xử lý logic matches khi nhận message từ broker', () => {
        let messageHandler: (t: string, p: Buffer) => void;

        const mockClient = {
            subscribe: jest.fn((topic, cb) => cb(null)),
            on: jest.fn((event, cb) => {
                if (event === 'message') {
                    messageHandler = cb; // Lưu lại handler để kích hoạt thủ công
                }
            }),
        };

        (service as any).client = mockClient;
        const callback = jest.fn();

        // 1. Đăng ký subscribe
        service.subscribe('home/+/status', callback);

        // 2. Giả lập Broker bắn tin nhắn tới client
        // Topic này khớp với pattern 'home/+/status'
        if (messageHandler) {
            messageHandler('home/livingroom/status', Buffer.from('online'));
        }

        // Kiểm tra xem hàm matches có làm việc và gọi callback của mình không
        expect(callback).toHaveBeenCalledWith(
            'home/livingroom/status',
            expect.any(Buffer)
        );
    });

    it('nên phủ nhánh lỗi khi Subscribe thất bại', () => {
        // Mock client đầy đủ các hàm để không gây lỗi TypeError
        const mockClient = {
            subscribe: jest.fn((topic, callback) => {
                // Giả lập lỗi trả về từ callback của thư viện mqtt
                callback(new Error('Subscribe Error'));
            }),
            on: jest.fn(), // ✅ PHẢI CÓ dòng này để tránh lỗi "this.client.on is not a function"
        };

        (service as any).client = mockClient;

        // Spy vào logger để kiểm tra xem nó có ghi lại lỗi không
        const loggerSpy = jest.spyOn((service as any).logger, 'error');

        service.subscribe('test/topic', () => {});

        // Kiểm tra xem logger.error đã được gọi với thông điệp mong muốn
        expect(loggerSpy).toHaveBeenCalledWith(
            expect.stringContaining('Subscribe error: Subscribe Error')
        );
    });
    it('nên xử lý khi nhận được message và so khớp topic', () => {
        const callback = jest.fn();
        const mockClient = {
            on: jest.fn((event, cb) => {
                if (event === 'message') {
                    // Giả lập nhận được tin nhắn từ Broker
                    cb('home/device/1/status', Buffer.from('online'));
                }
            }),
            subscribe: jest.fn(),
        };
        (service as any).client = mockClient;

        // Đăng ký subscribe để đưa callback vào danh sách xử lý
        service.subscribe('home/device/+/status', callback);

        // Kiểm tra xem hàm matches đã hoạt động và gọi callback chưa
        expect(callback).toHaveBeenCalledWith(
            'home/device/1/status',
            expect.any(Buffer)
        );
    });
    it('nên phủ logic message và matches', () => {
        let messageHandler: any;
        const mockClient = {
            on: jest.fn((event, cb) => {
                if (event === 'message') messageHandler = cb;
            }),
            subscribe: jest.fn((_, cb) => cb(null)),
            end: jest.fn(), // ✅ THÊM DÒNG NÀY để sửa lỗi TypeError
        };
        (service as any).client = mockClient;

        const cb = jest.fn();
        service.subscribe('home/+/temp', cb);

        // Kích hoạt logic matches (Phủ nhánh đỏ dòng 93-100)
        if (messageHandler) {
            messageHandler('home/livingroom/temp', Buffer.from('25'));
        }
        expect(cb).toHaveBeenCalled();

        // Gọi onModuleDestroy để phủ nhánh disconnect (Dòng 111-115)
        service.onModuleDestroy();
        expect(mockClient.end).toHaveBeenCalled();
    });
});
