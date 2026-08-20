import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PresignDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  mime: string;

  /** 大小上限（20MB）在 service 中校验并返回 422 */
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  size: number;
}
