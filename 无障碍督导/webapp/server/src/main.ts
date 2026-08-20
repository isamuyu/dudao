import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { HttpStatus, ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { config } from './config';

async function bootstrap() {
  // 启动时确保数据/上传目录存在
  if (config.dbType === 'sqlite') {
    fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
  }
  fs.mkdirSync(config.uploadDir, { recursive: true });

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // 参数校验失败统一返回 422（与业务校验一致），message 为中文可直接展示
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }));
  app.enableCors();
  await app.listen(config.port);
  new Logger('Bootstrap').log(
    `无障碍督导系统后端已启动: http://localhost:${config.port}/api (db=${config.dbType}, storage=${config.storageDriver})`,
  );
}
void bootstrap();
