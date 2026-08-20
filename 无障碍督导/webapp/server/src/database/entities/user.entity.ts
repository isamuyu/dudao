import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Role } from '../../common/decorators';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('text')
  id: string;

  /** platform_admin 为 null */
  @Column('text', { nullable: true })
  orgId: string | null;

  @Column('text')
  name: string;

  @Column('text', { unique: true })
  phone: string;

  @Column('text')
  role: Role;

  @Column('text', { default: 'active' })
  status: 'active' | 'disabled';

  @Column('text', { nullable: true })
  certNo: string | null;

  @Column('text', { nullable: true })
  certExpiresAt: string | null;

  @Column('text')
  passwordHash: string;
}

/** 响应用脱敏用户（去掉 passwordHash） */
export function toPublicUser(u: UserEntity) {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}
