import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTaskDto {
  @IsString({ message: '点位编号必须为字符串' })
  @IsNotEmpty({ message: '缺少督导点位' })
  pointId: string;

  @IsString({ message: '任务标题必须为字符串' })
  @IsNotEmpty({ message: '请填写任务标题' })
  title: string;

  @IsString({ message: '完成时限必须为字符串' })
  @IsNotEmpty({ message: '请选择完成时限' })
  deadline: string;

  @IsIn(['pool', 'assign'], { message: '任务分配方式只能为 pool（任务池）或 assign（指派）' })
  mode: 'pool' | 'assign';

  @IsOptional()
  @IsString({ message: '被指派人编号必须为字符串' })
  assigneeId?: string;
}

export class StartTaskDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '签到纬度必须为数字' })
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '签到经度必须为数字' })
  lng?: number;

  @IsOptional()
  @IsBoolean({ message: 'force 必须为布尔值' })
  force?: boolean;
}
