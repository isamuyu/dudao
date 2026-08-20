import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CampaignEntity,
  InspectionEntity,
  IssueEntity,
  OrgEntity,
  PointEntity,
  TaskEntity,
} from '../../database/entities';
import { PointsService } from './points.service';
import { PointsController } from './points.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PointEntity,
      CampaignEntity,
      OrgEntity,
      TaskEntity,
      IssueEntity,
      InspectionEntity,
    ]),
  ],
  providers: [PointsService],
  controllers: [PointsController],
})
export class PointsModule {}
