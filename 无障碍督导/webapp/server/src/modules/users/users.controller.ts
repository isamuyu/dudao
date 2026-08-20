import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { CreateUserDto, PatchUserDto, SelfPatchDto } from './dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('orgId') orgId?: string) {
    return this.users.list(user, orgId);
  }

  /** 用户自助：修改本人姓名/手机号/密码（需先于 :id 路由声明） */
  @Patch('me')
  selfPatch(@CurrentUser() user: AuthUser, @Body() dto: SelfPatchDto) {
    return this.users.selfPatch(user, dto);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(user, dto);
  }

  @Roles('admin')
  @Patch(':id')
  patch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PatchUserDto,
  ) {
    return this.users.patch(user, id, dto);
  }
}
