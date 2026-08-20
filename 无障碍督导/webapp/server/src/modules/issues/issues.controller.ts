import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IssuesService } from './issues.service';
import { AuthUser, CurrentUser, Roles } from '../../common/decorators';
import { AdvanceIssueDto, CreateIssueDto } from './dto';

@Controller('issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('pointId') pointId?: string,
  ) {
    return this.issues.list(user, status, pointId);
  }

  @Roles('inspector', 'admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateIssueDto) {
    return this.issues.create(user, dto);
  }

  @Post(':id/advance')
  advance(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: AdvanceIssueDto,
  ) {
    return this.issues.advance(user, id, dto);
  }
}
