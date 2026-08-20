import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePointDto {
  @IsString({ message: '所属行动必须为字符串' })
  @IsNotEmpty({ message: '缺少所属督导行动' })
  campaignId: string;

  @IsIn(['building', 'road'], { message: '点位类型只能为 building（建筑）或 road（道路）' })
  kind: 'building' | 'road';

  @IsString({ message: '名称必须为字符串' })
  @IsNotEmpty({ message: '请填写点位名称' })
  name: string;

  @IsOptional()
  @IsString({ message: '地址必须为字符串' })
  address?: string;

  @Type(() => Number)
  @IsNumber({}, { message: '纬度必须为数字' })
  lat: number;

  @Type(() => Number)
  @IsNumber({}, { message: '经度必须为数字' })
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '终点纬度必须为数字' })
  lat2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '终点经度必须为数字' })
  lng2?: number;

  @IsString({ message: '建筑分类必须为字符串' })
  @IsNotEmpty({ message: '请选择建筑类型/具体分类' })
  subtypeId: string;

  @IsString({ message: '建设性质必须为字符串' })
  @IsNotEmpty({ message: '请选择建设性质' })
  nature: string;

  @IsString({ message: '责任单位必须为字符串' })
  @IsNotEmpty({ message: '请填写责任单位' })
  owner: string;

  @IsString({ message: '联系电话必须为字符串' })
  @IsNotEmpty({ message: '请填写联系电话' })
  contact: string;

  /** 建点同时发布督导任务到任务池（默认前端勾选） */
  @IsOptional()
  @IsBoolean({ message: 'publishTask 必须为布尔值' })
  publishTask?: boolean;

  /** 任务标题（缺省自动生成：点位名+无障碍督导） */
  @IsOptional()
  @IsString({ message: '任务标题必须为字符串' })
  taskTitle?: string;

  /** 任务完成时限（yyyy-MM-dd，缺省为 14 天后） */
  @IsOptional()
  @IsString({ message: '任务完成时限必须为字符串' })
  taskDeadline?: string;
}

export class PatchPointDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng2?: number;

  @IsOptional()
  @IsString()
  subtypeId?: string;

  @IsOptional()
  @IsString()
  nature?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsIn(['pending', 'inspecting', 'issue', 'recheck', 'closed', 'blocked'])
  status?: 'pending' | 'inspecting' | 'issue' | 'recheck' | 'closed' | 'blocked';

  /** 变更原因，写入 changeLog */
  @IsOptional()
  @IsString()
  reason?: string;
}
