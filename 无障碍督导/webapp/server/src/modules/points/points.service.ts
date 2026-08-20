import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CampaignEntity,
  InspectionEntity,
  IssueEntity,
  OrgEntity,
  PointEntity,
  TaskEntity,
} from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { inBounds, nowIso, uid } from '../../common/geo';
import { CreatePointDto, PatchPointDto } from './dto';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(PointEntity)
    private readonly points: Repository<PointEntity>,
    @InjectRepository(CampaignEntity)
    private readonly campaigns: Repository<CampaignEntity>,
    @InjectRepository(OrgEntity)
    private readonly orgs: Repository<OrgEntity>,
    @InjectRepository(TaskEntity)
    private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(IssueEntity)
    private readonly issues: Repository<IssueEntity>,
    @InjectRepository(InspectionEntity)
    private readonly inspections: Repository<InspectionEntity>,
  ) {}

  list(user: AuthUser, campaignId?: string) {
    return this.points.find({
      where: { orgId: user.orgId!, ...(campaignId ? { campaignId } : {}) },
    });
  }

  async create(user: AuthUser, dto: CreatePointDto) {
    const org = await this.orgs.findOne({ where: { id: user.orgId! } });
    if (!org) throw new NotFoundException('组织不存在');
    if (!inBounds(org.bounds, dto.lat, dto.lng)) {
      throw new UnprocessableEntityException('点位超出组织督导区域');
    }
    const campaign = await this.campaigns.findOne({
      where: { id: dto.campaignId, orgId: user.orgId! },
    });
    if (!campaign) throw new NotFoundException('督导行动不存在');
    // 注：点位超出行动划定范围不禁止（仅由前端提醒），组织区域限制为硬性校验（见上）
    if (dto.kind === 'road' && (dto.lat2 == null || dto.lng2 == null)) {
      throw new UnprocessableEntityException('道路类点位必须包含线段终点坐标 lat2/lng2');
    }
    const now = nowIso();
    const entity = this.points.create({
      id: uid('p'),
      orgId: user.orgId!,
      campaignId: dto.campaignId,
      kind: dto.kind,
      name: dto.name,
      address: dto.address ?? '',
      lat: dto.lat,
      lng: dto.lng,
      lat2: dto.lat2 ?? null,
      lng2: dto.lng2 ?? null,
      subtypeId: dto.subtypeId,
      nature: dto.nature,
      owner: dto.owner,
      contact: dto.contact,
      status: 'pending',
      locked: true,
      createdBy: user.name,
      createdAt: now,
      updatedAt: now,
      changeLog: [],
    });
    const saved = await this.points.save(entity);
    // 建点同时发布督导任务到任务池（原子完成）
    let publishedTask = null;
    if (dto.publishTask) {
      const deadline =
        dto.taskDeadline ??
        new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      publishedTask = await this.tasks.save(
        this.tasks.create({
          id: uid('t'),
          orgId: user.orgId!,
          pointId: saved.id,
          title: dto.taskTitle ?? `${dto.name}无障碍督导`,
          deadline,
          mode: 'pool',
          assigneeId: null,
          status: 'pool',
          createdAt: now,
        }),
      );
    }
    return { ...saved, publishedTask };
  }

  async patch(user: AuthUser, id: string, dto: PatchPointDto) {
    const point = await this.points.findOne({
      where: { id, orgId: user.orgId! },
    });
    if (!point) throw new NotFoundException('点位不存在');

    // 位置与类别变更自动追加 changeLog
    const trackFields = ['lat', 'lng', 'lat2', 'lng2', 'subtypeId'] as const;
    for (const f of trackFields) {
      const v = dto[f];
      if (v !== undefined && v !== point[f]) {
        point.changeLog = [
          ...(point.changeLog ?? []),
          { at: nowIso(), by: user.name, field: f, from: point[f], to: v, ...(dto.reason ? { reason: dto.reason } : {}) },
        ];
        (point as unknown as Record<string, unknown>)[f] = v;
      }
    }
    const plainFields = ['name', 'address', 'nature', 'owner', 'contact', 'status'] as const;
    for (const f of plainFields) {
      if (dto[f] !== undefined)
        (point as unknown as Record<string, unknown>)[f] = dto[f];
    }
    point.updatedAt = nowIso();
    return this.points.save(point);
  }

  async detail(user: AuthUser, id: string) {
    const point = await this.points.findOne({
      where: { id, orgId: user.orgId! },
    });
    if (!point) throw new NotFoundException('点位不存在');
    const [tasks, issues, inspections] = await Promise.all([
      this.tasks.find({ where: { pointId: id, orgId: user.orgId! } }),
      this.issues.find({ where: { pointId: id, orgId: user.orgId! } }),
      this.inspections.find({ where: { pointId: id, orgId: user.orgId! } }),
    ]);
    return { point, tasks, issues, inspections };
  }
}
