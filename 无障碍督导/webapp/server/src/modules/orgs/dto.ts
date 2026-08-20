import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateOrgDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  orgType: string;

  @IsString()
  @IsNotEmpty()
  regionName: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  center: [number, number];

  @IsArray()
  @ArrayNotEmpty()
  bounds: [[number, number], [number, number]];

  @IsOptional()
  @IsString()
  expiresAt?: string;

  /** 首位组织管理员姓名（与 adminPhone 成对提供） */
  @IsOptional()
  @IsString()
  adminName?: string;

  /** 首位组织管理员手机号（登录账号） */
  @IsOptional()
  @IsString()
  adminPhone?: string;

  /** 管理员初始密码，默认 123456 */
  @IsOptional()
  @IsString()
  @MinLength(6)
  adminPassword?: string;
}

export class PatchOrgDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  orgType?: string;

  @IsOptional()
  @IsString()
  regionName?: string;

  @IsOptional()
  @IsArray()
  center?: [number, number];

  @IsOptional()
  @IsArray()
  bounds?: [[number, number], [number, number]];

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
