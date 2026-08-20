import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { OrgEntity, UserEntity, toPublicUser } from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { nowIso, uid } from '../../common/geo';
import { CreateOrgDto, PatchOrgDto } from './dto';

@Injectable()
export class OrgsService {
  constructor(
    @InjectRepository(OrgEntity)
    private readonly orgs: Repository<OrgEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  /** platform_admin 返回全部；其余返回本组织（数组，1 条） */
  list(user: AuthUser) {
    if (user.role === 'platform_admin') return this.orgs.find();
    return this.orgs.find({ where: { id: user.orgId! } });
  }

  /** 创建组织，可同时开通首位组织管理员账号 */
  async create(dto: CreateOrgDto) {
    if (dto.adminPhone || dto.adminName) {
      if (!dto.adminPhone || !dto.adminName)
        throw new UnprocessableEntityException('管理员姓名与手机号需同时填写');
      const exists = await this.users.findOne({ where: { phone: dto.adminPhone } });
      if (exists) throw new UnprocessableEntityException('该手机号已被注册');
    }
    const org = await this.orgs.save(
      this.orgs.create({
        id: uid('org'),
        name: dto.name,
        orgType: dto.orgType,
        regionName: dto.regionName,
        center: dto.center,
        bounds: dto.bounds,
        status: 'active',
        expiresAt: dto.expiresAt ?? null,
      }),
    );
    let adminUser = null;
    if (dto.adminPhone && dto.adminName) {
      adminUser = toPublicUser(
        await this.users.save(
          this.users.create({
            id: uid('u'),
            orgId: org.id,
            name: dto.adminName,
            phone: dto.adminPhone,
            role: 'admin',
            status: 'active',
            certNo: null,
            certExpiresAt: null,
            passwordHash: bcrypt.hashSync(dto.adminPassword ?? '123456', 10),
          }),
        ),
      );
    }
    return { org, adminUser };
  }

  async patch(id: string, dto: PatchOrgDto) {
    const org = await this.orgs.findOne({ where: { id } });
    if (!org) throw new NotFoundException('组织不存在');
    Object.assign(org, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.orgType !== undefined && { orgType: dto.orgType }),
      ...(dto.regionName !== undefined && { regionName: dto.regionName }),
      ...(dto.center !== undefined && { center: dto.center }),
      ...(dto.bounds !== undefined && { bounds: dto.bounds }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt }),
    });
    void nowIso;
    return this.orgs.save(org);
  }
}
