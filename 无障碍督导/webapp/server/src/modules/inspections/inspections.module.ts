import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InspectionEntity,
  IssueEntity,
  PointEntity,
  TaskEntity,
} from '../../database/entities';
import { InspectionsService } from './inspections.service';
import { InspectionsController } from './inspections.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InspectionEntity,
      IssueEntity,
      PointEntity,
      TaskEntity,
    ]),
  ],
  providers: [InspectionsService],
  controllers: [InspectionsController],
})
export class InspectionsModule {}
