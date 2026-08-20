import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssueEntity, InspectionEntity, PointEntity } from '../../database/entities';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PointEntity, IssueEntity, InspectionEntity])],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
