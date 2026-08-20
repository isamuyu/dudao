import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity, OrgEntity } from '../../database/entities';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignEntity, OrgEntity])],
  providers: [CampaignsService],
  controllers: [CampaignsController],
})
export class CampaignsModule {}
