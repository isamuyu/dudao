import {
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { InstanceResult, MainInfo } from '../../database/entities/inspection.entity';

export class CreateInspectionDto {
  @IsString()
  @IsNotEmpty()
  taskId: string;

  @IsObject()
  mainInfo: MainInfo;

  @IsArray()
  instances: InstanceResult[];

  /** 条件设置(C)缺失设施中，现场确认触发条件已满足的设施 id（仅这些立案） */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  condTriggered?: string[];
}
