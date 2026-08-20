import { Module } from '@nestjs/common';
import { ChecklibController } from './checklib.controller';

@Module({
  controllers: [ChecklibController],
})
export class ChecklibModule {}
