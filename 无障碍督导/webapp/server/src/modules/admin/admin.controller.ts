import { Controller, Post } from '@nestjs/common';
import { SeedService } from '../../seed/seed.service';
import { Roles } from '../../common/decorators';

@Controller('admin')
export class AdminController {
  constructor(private readonly seed: SeedService) {}

  /** 清空全部业务数据并重新种子化 */
  @Roles('platform_admin')
  @Post('reseed')
  async reseed() {
    await this.seed.reseed();
    return { ok: true };
  }
}
