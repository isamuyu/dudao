import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { IssueStatus } from '../../database/entities';

export class CreateIssueDto {
  @IsString()
  @IsNotEmpty()
  pointId: string;

  @IsString()
  @IsNotEmpty()
  facility: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  requirement: string;

  @IsString()
  @IsNotEmpty()
  clause: string;

  @IsIn(['M', 'C', 'R'])
  severity: 'M' | 'C' | 'R';

  @IsString()
  @IsNotEmpty()
  desc: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class AdvanceIssueDto {
  /** 目标状态；缺省时按状态机默认唯一去向（recheck 缺省 → closed；deferred 缺省 → assigned） */
  @IsOptional()
  @IsIn(['deferred', 'assigned', 'fixing', 'recheck', 'closed'])
  to?: IssueStatus;

  /** action 文案可覆盖服务端默认 */
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  /** open → assigned 时写入问题单 */
  @IsOptional()
  @IsString()
  responsible?: string;

  @IsOptional()
  @IsString()
  deadline?: string;
}
