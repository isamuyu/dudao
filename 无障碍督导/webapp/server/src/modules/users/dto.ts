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
