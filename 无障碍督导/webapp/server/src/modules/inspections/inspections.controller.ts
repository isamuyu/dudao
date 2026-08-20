import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { CreateInspectionDto } from './dto';

@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspections: InspectionsService) {}

  @Roles('inspector', 'admin')
  @Post()
  submit(@CurrentUser() user: AuthUser, @Body() dto: CreateInspectionDto) {
    return this.inspections.submit(user, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('pointId') pointId?: string) {
    return this.inspections.list(user, pointId);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inspections.detail(user, id);
  }
}
