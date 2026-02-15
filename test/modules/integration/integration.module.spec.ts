import { IntegrationModule } from 'src/modules/integration/integration.module';

describe('IntegrationModule', () => {
    it('should be defined', () => {
        const module = new IntegrationModule();
        expect(module).toBeDefined();
    });
});
