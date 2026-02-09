import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { DatabaseModule } from 'src/common/database/database.module';

@Module({
    imports: [
        DatabaseModule, // <--- BẮT BUỘC PHẢI CÓ DÒNG NÀY
        // Các module khác...
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}
