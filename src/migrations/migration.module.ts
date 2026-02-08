import { Module } from '@nestjs/common';
import { CommandModule } from 'nestjs-command';

import { CommonModule } from 'src/common/common.module';
import { AdminMigrationSeed } from './admin.seed';


@Module({
    imports: [CommonModule, CommandModule],
    providers: [AdminMigrationSeed],
    exports: [AdminMigrationSeed],
})
export class MigrationModule {}
