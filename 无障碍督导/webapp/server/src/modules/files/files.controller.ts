import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import { AuthUser, CurrentUser } from '../../common/decorators';
import { PresignDto } from './dto';

async function readRawBody(req: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('presign')
  presign(@CurrentUser() user: AuthUser, @Body() dto: PresignDto) {
    return this.files.presign(user, dto);
  }

  /** local 驱动上传端点：PUT 原始二进制（Content-Type 为原始 mime） */
  @Put(':id/content')
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const body = await readRawBody(req);
    const file = await this.files.upload(user, id, body);
    return { file };
  }

  /** 流式下载（鉴权：Header 或 ?token=，在 JwtGuard 中处理） */
  @Get(':id')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { file, data } = await this.files.download(user, id);
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Length', data.length);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
    );
    res.end(data);
  }
}
