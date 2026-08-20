import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './decorators';

/** 全局 JWT 鉴权：支持 Authorization: Bearer 与 ?token=（供 <img> 下载文件） */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const auth: string | undefined = req.headers['authorization'];
    let token: string | undefined =
      auth && auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (!token && typeof req.query?.token === 'string') token = req.query.token;
    if (!token) throw new UnauthorizedException('未登录或登录已过期');

    try {
      const p = this.jwt.verify(token);
      req.user = {
        id: p.sub,
        orgId: p.orgId ?? null,
        role: p.role,
        name: p.name,
      };
      return true;
    } catch {
      throw new UnauthorizedException('未登录或登录已过期');
    }
  }
}
