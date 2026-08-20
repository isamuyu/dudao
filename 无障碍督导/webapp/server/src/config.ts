import * as path from 'path';

/** 集中配置：默认值与 webapp/.env.example 保持一致 */
export const config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  dbType: (process.env.DB_TYPE ?? 'sqlite') as 'sqlite' | 'postgres',
  /** 相对路径基于进程工作目录（server/），默认落在 webapp/data/dudao.db */
  sqlitePath: path.resolve(process.cwd(), process.env.SQLITE_PATH ?? '../data/dudao.db'),
  pg: {
    host: process.env.PG_HOST ?? 'localhost',
    port: parseInt(process.env.PG_PORT ?? '5432', 10),
    username: process.env.PG_USER ?? 'dudao',
    password: process.env.PG_PASSWORD ?? 'dudao123',
    database: process.env.PG_DB ?? 'dudao',
  },
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtExpiresIn: '7d' as const,
  storageDriver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? '../data/uploads'),
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'dudao-files',
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin123',
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? 'true') === 'true',
  },
  /** 上传限制：20MB */
  maxFileSize: 20 * 1024 * 1024,
  checklibVersion: '1.4',
};
