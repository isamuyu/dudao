import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignEntity, CheckProfileEntity, OrgEntity } from '../../database/entities';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignEntity, OrgEntity, CheckProfileEntity])],
  providers: [CampaignsService],
  controllers: [CampaignsController],
})
export class CampaignsModule {}
