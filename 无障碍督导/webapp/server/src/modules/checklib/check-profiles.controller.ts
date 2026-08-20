import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CheckProfileEntity } from '../../database/entities';

/** 默认检查项配置（内置"督导员快速检查表"） */
export const DEFAULT_PROFILE_ID = 'prof-quick';

/** 检查项配置版本：平台级只读，行动创建时选用 */
@Controller('check-profiles')
export class CheckProfilesController {
  constructor(
    @InjectRepository(CheckProfileEntity)
    private readonly profiles: Repository<CheckProfileEntity>,
  ) {}

  /** 列表（不含 payload 全文） */
  @Get()
  async list() {
    const list = await this.profiles.find();
    return list.map(({ payload: _payload, ...meta }) => meta);
  }

  /** 详情（含完整配置内容） */
  @Get(':id')
  async detail(@Param('id') id: string) {
    const profile = await this.profiles.findOne({ where: { id } });
    if (!profile) throw new NotFoundException('检查项配置不存在');
    return profile;
  }
}
