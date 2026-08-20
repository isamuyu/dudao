import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser, Role, ROLES_KEY } from './decorators';

/** 全局角色守卫：无 @Roles 元数据的接口任意登录用户可访问；'admin' 含 platform_admin */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('无权访问');
    const ok =
      roles.includes(user.role) ||
      (user.role === 'platform_admin' && roles.includes('admin'));
    if (!ok) throw new ForbiddenException('无权执行该操作');
    return true;
  }
}

/** 服务层动态角色判断（如问题单状态机不同流转的角色要求） */
export function hasRole(user: AuthUser, roles: Role[]): boolean {
  return (
    roles.includes(user.role) ||
    (user.role === 'platform_admin' && roles.includes('admin'))
  );
}
