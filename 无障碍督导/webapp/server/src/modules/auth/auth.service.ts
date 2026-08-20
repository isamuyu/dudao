import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { OrgEntity, UserEntity, toPublicUser } from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { LoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(OrgEntity)
    private readonly orgs: Repository<OrgEntity>,
    private readonly jwt: JwtService,
  ) {}

  private async orgOf(orgId: string | null): Promise<OrgEntity | null> {
    if (!orgId) return null;
    return this.orgs.findOne({ where: { id: orgId } });
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ where: { phone: dto.phone } });
    if (!user || !bcrypt.compareSync(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('手机号或密码错误');
    }
    if (user.status === 'disabled') {
      throw new UnauthorizedException('账号已停用');
    }
    const token = this.jwt.sign({
      sub: user.id,
      orgId: user.orgId,
      role: user.role,
      name: user.name,
    });
    return { token, user: toPublicUser(user), org: await this.orgOf(user.orgId) };
  }

  async me(me: AuthUser) {
    const user = await this.users.findOne({ where: { id: me.id } });
    if (!user) throw new UnauthorizedException('用户不存在');
    return { user: toPublicUser(user), org: await this.orgOf(user.orgId) };
  }
}
