import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Bounds } from '../../common/geo';

export class CreateCampaignDto {
  @IsString({ message: '行动名称必须为字符串' })
  @IsNotEmpty({ message: '请填写行动名称' })
  name: string;

  @IsOptional()
  @IsString({ message: '区域描述必须为字符串' })
  regionDesc?: string;

  /** 行动大致范围（可选，不划定则表示整个组织区域） */
  @IsOptional()
  @IsArray({ message: '行动范围格式不正确' })
  bounds?: Bounds;

  /** 检查项配置版本 id（缺省为默认配置"督导员快速检查表"） */
  @IsOptional()
  @IsString({ message: '检查项配置必须为字符串' })
  profileId?: string;
}

export class PatchCampaignDto {
  @IsOptional()
  @IsIn(['active', 'done'], { message: '行动状态只能为 active 或 done' })
  status?: 'active' | 'done';
}
