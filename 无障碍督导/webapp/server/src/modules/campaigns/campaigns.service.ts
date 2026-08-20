import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignEntity, OrgEntity } from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { inBounds, nowIso, uid } from '../../common/geo';
import { CreateCampaignDto, PatchCampaignDto } from './dto';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectRepository(CampaignEntity)
    private readonly campaigns: Repository<CampaignEntity>,
    @InjectRepository(OrgEntity)
    private readonly orgs: Repository<OrgEntity>,
  ) {}

  list(user: AuthUser) {
    return this.campaigns.find({ where: { orgId: user.orgId! } });
  }

  async create(user: AuthUser, dto: CreateCampaignDto) {
    const org = await this.orgs.findOne({ where: { id: user.orgId! } });
    if (!org) throw new NotFoundException('组织不存在');
    // 划定范围时，bounds 必须在组织区域内；不划定则允许（表示整个组织区域）
    if (dto.bounds) {
      const [[minLat, minLng], [maxLat, maxLng]] = dto.bounds;
      if (!inBounds(org.bounds, minLat, minLng) || !inBounds(org.bounds, maxLat, maxLng)) {
        throw new UnprocessableEntityException('行动区域超出组织督导区域');
      }
    }
    const entity = this.campaigns.create({
      id: uid('c'),
      orgId: user.orgId!,
      name: dto.name,
      regionDesc: dto.regionDesc ?? '',
      bounds: dto.bounds ?? null,
      createdBy: user.name,
      createdAt: nowIso(),
      status: 'active',
    });
    return this.campaigns.save(entity);
  }

  async patch(user: AuthUser, id: string, dto: PatchCampaignDto) {
    const campaign = await this.campaigns.findOne({
      where: { id, orgId: user.orgId! },
    });
    if (!campaign) throw new NotFoundException('督导行动不存在');
    if (dto.status !== undefined) campaign.status = dto.status;
    return this.campaigns.save(campaign);
  }
}
