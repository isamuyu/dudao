import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';

export type Role = 'platform_admin' | 'admin' | 'inspector';

/** 注入到 request.user 的认证主体 */
export interface AuthUser {
  id: string;
  orgId: string | null;
  role: Role;
  name: string;
}

export const IS_PUBLIC_KEY = 'isPublic';
/** 放行免鉴权接口（如 /auth/login） */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** 限定接口角色；'admin' 自动包含 platform_admin */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** 当前登录用户参数装饰器 */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => {
    return ctx.switchToHttp().getRequest().user;
  },
);
