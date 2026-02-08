import { Module } from '@nestjs/common';
import { ProvisioningService } from './services/provisioning.service';
import { ProvisioningController } from './controllers/provisioning.controller';
import { DatabaseModule } from 'src/common/database/database.module';
import { HelperModule } from 'src/common/helper/helper.module';

@Module({
    imports: [DatabaseModule, HelperModule], // Nhớ import DatabaseModule vào đây nếu nó ko phải Global
    controllers: [ProvisioningController],
    providers: [ProvisioningService],
    exports: [ProvisioningService],
})
export class ProvisioningModule {}
