import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileEntity } from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { nowIso, uid } from '../../common/geo';
import { STORAGE, StorageDriver } from '../../storage/storage.module';
import { PresignDto } from './dto';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly files: Repository<FileEntity>,
    @Inject(STORAGE) private readonly storage: StorageDriver,
  ) {}

  private keyOf(file: FileEntity) {
    return `${file.orgId}/${file.id}`;
  }

  /** 预签名：校验 mime 与大小，返回 FileMeta + uploadUrl */
  async presign(user: AuthUser, dto: PresignDto) {
    if (!/^image\//.test(dto.mime) && !/^video\//.test(dto.mime)) {
      throw new UnprocessableEntityException('仅支持图片或视频文件');
    }
    if (dto.size > 20 * 1024 * 1024) {
      throw new UnprocessableEntityException('文件大小不能超过 20MB');
    }
    const file = await this.files.save(
      this.files.create({
        id: uid('f'),
        orgId: user.orgId!,
        filename: dto.filename,
        mime: dto.mime,
        size: dto.size,
        uploadedBy: user.id,
        createdAt: nowIso(),
      }),
    );
    // local：前端 PUT 到本服务；s3：MinIO 预签名 PUT
    const uploadUrl =
      this.storage.driver === 's3'
        ? await this.storage.presignPut!(this.keyOf(file), file.mime)
        : `/api/files/${file.id}/content`;
    return { file, uploadUrl };
  }

  /** local 驱动上传（PUT 二进制） */
  async upload(user: AuthUser, id: string, body: Buffer) {
    const file = await this.files.findOne({
      where: { id, orgId: user.orgId! },
    });
    if (!file) throw new NotFoundException('文件不存在');
    await this.storage.put(this.keyOf(file), body, file.mime);
    return file;
  }

  /** 下载：校验 org 归属，跨组织 404 */
  async download(user: AuthUser, id: string) {
    const file = await this.files.findOne({
      where: { id, orgId: user.orgId! },
    });
    if (!file) throw new NotFoundException('文件不存在');
    const data = await this.storage.get(this.keyOf(file));
    return { file, data };
  }
}
