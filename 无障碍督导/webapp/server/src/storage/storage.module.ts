import { Global, Module } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

export const STORAGE = 'STORAGE';

/** 文件存储驱动抽象：local（本地磁盘）/ s3（MinIO 预签名） */
export interface StorageDriver {
  readonly driver: 'local' | 's3';
  put(key: string, body: Buffer, mime: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** 仅 s3 驱动可用：生成预签名 PUT URL */
  presignPut?(key: string, mime: string): Promise<string>;
}

class LocalStorage implements StorageDriver {
  readonly driver = 'local' as const;

  private resolve(key: string) {
    const p = path.resolve(config.uploadDir, key);
    if (!p.startsWith(config.uploadDir)) throw new Error('invalid key');
    return p;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const p = this.resolve(key);
    await fs.promises.mkdir(path.dirname(p), { recursive: true });
    await fs.promises.writeFile(p, body);
  }

  async get(key: string): Promise<Buffer> {
    return fs.promises.readFile(this.resolve(key));
  }
}

class S3Storage implements StorageDriver {
  readonly driver = 's3' as const;
  private client: import('@aws-sdk/client-s3').S3Client;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
    this.client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      forcePathStyle: config.s3.forcePathStyle,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
    await this.client.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: body,
        ContentType: mime,
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const { GetObjectCommand } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: key }),
    );
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async presignPut(key: string, mime: string): Promise<string> {
    const { PutObjectCommand } = require('@aws-sdk/client-s3') as typeof import('@aws-sdk/client-s3');
    const { getSignedUrl } =
      require('@aws-sdk/s3-request-presigner') as typeof import('@aws-sdk/s3-request-presigner');
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        ContentType: mime,
      }),
      { expiresIn: 900 },
    );
  }
}

@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      useFactory: (): StorageDriver =>
        config.storageDriver === 's3' ? new S3Storage() : new LocalStorage(),
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
