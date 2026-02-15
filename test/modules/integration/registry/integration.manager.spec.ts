import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationManager } from 'src/modules/integration/registry/integration.manager';
import { MqttGenericDriver } from 'src/modules/integration/drivers/mqtt-generic.driver';
import { DeviceProtocol } from '@prisma/client';

describe('IntegrationManager', () => {
    let manager: IntegrationManager;
    const mockMqttDriver = { name: 'MQTT', setValue: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                IntegrationManager,
                { provide: MqttGenericDriver, useValue: mockMqttDriver },
            ],
        }).compile();

        manager = module.get<IntegrationManager>(IntegrationManager);

        // ✅ CỰC KỲ QUAN TRỌNG: Phải gọi hàm này để kích hoạt việc đăng ký Driver vào Map
        // Điều này sẽ đẩy Coverage functions lên > 90%
        await manager.onModuleInit();
    });

    it('nên đăng ký driver thành công khi khởi tạo', () => {
        // ✅ Gọi đúng protocol đã mock ở trên
        const driver = manager.getDriver('MQTT');
        expect(driver).toBeDefined();
        expect(driver.name).toBe('MQTT');
    });
    it('nên chạy qua logic onModuleInit để phủ coverage', async () => {
        // Ép kiểu để truy cập hàm private/lifecycle
        await (manager as any).onModuleInit();
        // Kiểm tra xem Map drivers đã được khởi tạo hay chưa
        expect((manager as any).drivers).toBeDefined();
    });

    it('should execute onModuleInit and register drivers', async () => {
        // Gọi trực tiếp hàm lifecycle để phủ coverage function
        await (manager as any).onModuleInit();

        // Giả lập trường hợp gọi getDriver với protocol không tồn tại
        // để phủ dòng "throw new Error"
        expect(() => manager.getDriver('UNKNOWN')).toThrow();
    });
    it('nên phủ nốt logic lấy driver hợp lệ', () => {
        // Giả sử bạn đã đăng ký driver cho MQTT
        const driver = manager.getDriver(DeviceProtocol.MQTT);
        expect(driver).toBeDefined();
    });
    it('nên phủ nốt logic khởi tạo Driver (onModuleInit)', async () => {
        // Gọi thủ công hàm lifecycle để phủ coverage function
        await manager.onModuleInit();

        // Kiểm tra xem driver đã được đăng ký vào Map chưa
        const driver = manager.getDriver(DeviceProtocol.MQTT);
        expect(driver).toBeDefined();
    });
    it('nên phủ nốt hàm getDriver với protocol hợp lệ', () => {
        // Ép kiểu protocol hợp lệ từ Enum của bạn
        const driver = manager.getDriver(DeviceProtocol.MQTT);
        expect(driver).toBeDefined();
    });
});
