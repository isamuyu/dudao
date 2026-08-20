import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsIn(['admin', 'inspector'])
  role: 'admin' | 'inspector';

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  /** 仅 platform_admin 可指定目标组织 */
  @IsOptional()
  @IsString()
  orgId?: string;
}

export class PatchUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['admin', 'inspector'])
  role?: 'admin' | 'inspector';

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';

  @IsOptional()
  @IsString()
  certNo?: string;

  @IsOptional()
  @IsString()
  certExpiresAt?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}

/** 用户自助修改（本人）：姓名 / 手机号 / 密码（改密码需校验旧密码） */
export class SelfPatchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  oldPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  newPassword?: string;
}
