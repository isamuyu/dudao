import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AuthUser, CurrentUser } from '../../common/decorators';

@Controller('stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('overview')
  overview(
    @CurrentUser() user: AuthUser,
    @Query('orgId') orgId?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.stats.overview(user, orgId, campaignId);
  }
}
