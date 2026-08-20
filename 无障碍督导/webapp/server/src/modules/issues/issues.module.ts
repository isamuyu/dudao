import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssueEntity, PointEntity } from '../../database/entities';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IssueEntity, PointEntity])],
  providers: [IssuesService],
  controllers: [IssuesController],
})
export class IssuesModule {}
