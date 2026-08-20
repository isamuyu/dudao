import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { CreateTaskDto, StartTaskDto } from './dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.tasks.list(user);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(user, dto);
  }

  @Roles('inspector', 'admin')
  @Post(':id/claim')
  claim(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.claim(user, id);
  }

  @Post(':id/start')
  start(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: StartTaskDto,
  ) {
    return this.tasks.start(user, id, dto);
  }

  @Post(':id/release')
  release(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.release(user, id);
  }

  /** 组织管理员：已结办任务退回编辑状态（done/blocked → doing） */
  @Roles('admin')
  @Post(':id/return')
  returnToDoing(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.returnToDoing(user, id);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.detail(user, id);
  }
}
