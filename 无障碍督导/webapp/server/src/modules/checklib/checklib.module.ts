import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckProfileEntity } from '../../database/entities';
import { ChecklibController } from './checklib.controller';
import { CheckProfilesController } from './check-profiles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CheckProfileEntity])],
  controllers: [ChecklibController, CheckProfilesController],
})
export class ChecklibModule {}
