import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity, toPublicUser } from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { uid } from '../../common/geo';
import { CreateUserDto, PatchUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  /** 本组织用户列表；platform_admin 可 ?orgId= 指定，缺省返回全部 */
  async list(user: AuthUser, orgId?: string) {
    let where: { orgId?: string } = {};
    if (user.role === 'platform_admin') {
      if (orgId) where = { orgId };
    } else {
      where = { orgId: user.orgId! };
    }
    const list = await this.users.find({ where });
    return list.map(toPublicUser);
  }

  async create(user: AuthUser, dto: CreateUserDto) {
    const exists = await this.users.findOne({ where: { phone: dto.phone } });
    if (exists) throw new UnprocessableEntityException('该手机号已被注册');
    const orgId =
      user.role === 'platform_admin' ? (dto.orgId ?? null) : user.orgId;
    if (!orgId) throw new UnprocessableEntityException('必须指定用户所属组织');
    const entity = this.users.create({
      id: uid('u'),
      orgId,
      name: dto.name,
      phone: dto.phone,
      role: dto.role,
      status: 'active',
      certNo: null,
      certExpiresAt: null,
      passwordHash: bcrypt.hashSync(dto.password ?? '123456', 10),
    });
    return toPublicUser(await this.users.save(entity));
  }

  async patch(user: AuthUser, id: string, dto: PatchUserDto) {
    const target = await this.users.findOne({ where: { id } });
    // 租户隔离：跨组织访问与不存在一致（platform_admin 不受限）
    if (!target || (user.role !== 'platform_admin' && target.orgId !== user.orgId)) {
      throw new NotFoundException('用户不存在');
    }
    if (dto.name !== undefined) target.name = dto.name;
    if (dto.role !== undefined) target.role = dto.role;
    if (dto.status !== undefined) target.status = dto.status;
    if (dto.certNo !== undefined) target.certNo = dto.certNo;
    if (dto.certExpiresAt !== undefined) target.certExpiresAt = dto.certExpiresAt;
    if (dto.password !== undefined)
      target.passwordHash = bcrypt.hashSync(dto.password, 10);
    return toPublicUser(await this.users.save(target));
  }
}
