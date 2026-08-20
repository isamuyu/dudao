import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { OrgsService } from './orgs.service';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { CreateOrgDto, PatchOrgDto } from './dto';

@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orgs.list(user);
  }

  @Roles('platform_admin')
  @Post()
  create(@Body() dto: CreateOrgDto) {
    return this.orgs.create(dto);
  }

  @Roles('platform_admin')
  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: PatchOrgDto) {
    return this.orgs.patch(id, dto);
  }
}
