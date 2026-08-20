import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PointsService } from './points.service';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { CreatePointDto, PatchPointDto } from './dto';

@Controller('points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('campaignId') campaignId?: string) {
    return this.points.list(user, campaignId);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePointDto) {
    return this.points.create(user, dto);
  }

  @Roles('admin')
  @Patch(':id')
  patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchPointDto,
  ) {
    return this.points.patch(user, id, dto);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.points.detail(user, id);
  }
}
