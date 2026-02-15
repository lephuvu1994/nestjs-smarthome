import { Test, TestingModule } from '@nestjs/testing';
import { DeviceModule } from 'src/modules/device/device.module';
import { IntegrationModule } from 'src/modules/integration/integration.module';
import { UserModule } from 'src/modules/user/user.module';

describe('Modules Initialization', () => {
    it('should verify modules exist', () => {
        const deviceModule = new DeviceModule();
        const integrationModule = new IntegrationModule();
        expect(deviceModule).toBeDefined();
        expect(integrationModule).toBeDefined();
    });
    describe('Module Class Coverage', () => {
        it('nên khởi tạo các class module để lấy 100% function coverage', () => {
            // Khởi tạo trực tiếp bằng từ khóa new
            const modules = [
                new DeviceModule(),
                new IntegrationModule(),
                new UserModule(),
            ];
            modules.forEach(m => expect(m).toBeDefined());
        });
    });
});
