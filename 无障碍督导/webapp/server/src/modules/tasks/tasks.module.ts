import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  InspectionEntity,
  IssueEntity,
  PointEntity,
  TaskEntity,
  UserEntity,
} from '../../database/entities';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaskEntity,
      PointEntity,
      InspectionEntity,
      IssueEntity,
      UserEntity,
    ]),
  ],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
