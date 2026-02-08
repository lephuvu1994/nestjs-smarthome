import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { DatabaseModule } from 'src/common/database/database.module';

@Module({
    controllers: [AdminController, DatabaseModule],
    providers: [AdminService],
})
export class AdminModule {}
