import { Module } from '@nestjs/common';
import { SeedModule } from '../../seed/seed.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [SeedModule],
  controllers: [AdminController],
})
export class AdminModule {}
