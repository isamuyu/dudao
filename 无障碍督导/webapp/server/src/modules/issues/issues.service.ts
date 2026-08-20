import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import {
  IssueEntity,
  IssueStatus,
  PointEntity,
} from '../../database/entities';
import { AuthUser, Role } from '../../common/decorators';
import { hasRole } from '../../common/roles.guard';
import { nowIso, shortName, uid } from '../../common/geo';
import { AdvanceIssueDto, CreateIssueDto } from './dto';

/** 问题单状态机：与契约第 3 节一致 */
const TRANSITIONS: Record<
  string,
  { to: IssueStatus; roles: Role[]; action: string }
> = {
  'open>assigned': { to: 'assigned', roles: ['admin'], action: '审核立案并派单' },
  'open>deferred': { to: 'deferred', roles: ['admin'], action: '暂不立案' },
  'deferred>assigned': { to: 'assigned', roles: ['admin'], action: '审核立案并派单' },
  'assigned>fixing': { to: 'fixing', roles: ['admin', 'inspector'], action: '整改反馈' },
  'fixing>recheck': { to: 'recheck', roles: ['admin', 'inspector'], action: '整改完成，申请复查' },
  'recheck>closed': { to: 'closed', roles: ['admin', 'inspector'], action: '复查通过，闭环销号' },
  'recheck>fixing': { to: 'fixing', roles: ['admin', 'inspector'], action: '复查不通过，退回整改' },
};

/** 每个当前状态的默认去向（recheck 默认闭环；deferred 可补立案） */
const DEFAULT_NEXT: Record<IssueStatus, IssueStatus | null> = {
  open: 'assigned',
  deferred: 'assigned',
  assigned: 'fixing',
  fixing: 'recheck',
  recheck: 'closed',
  closed: null,
};

@Injectable()
export class IssuesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(IssueEntity)
    private readonly issues: Repository<IssueEntity>,
  ) {}

  list(user: AuthUser, status?: string, pointId?: string) {
    return this.issues.find({
      where: {
        orgId: user.orgId!,
        ...(status ? { status: status as IssueStatus } : {}),
        ...(pointId ? { pointId } : {}),
      },
    });
  }

  /** 手动登记问题单；点位若非 closed/blocked 则置 issue */
  async create(user: AuthUser, dto: CreateIssueDto) {
    return this.dataSource.transaction(async (em) => {
      const points = em.getRepository(PointEntity);
      const issuesRepo = em.getRepository(IssueEntity);
      const point = await points.findOne({
        where: { id: dto.pointId, orgId: user.orgId! },
      });
      if (!point) throw new NotFoundException('点位不存在');
      const now = nowIso();
      const issue = issuesRepo.create({
        id: uid('i'),
        orgId: user.orgId!,
        pointId: dto.pointId,
        inspectionId: null,
        facility: dto.facility,
        title: dto.title,
        requirement: dto.requirement,
        clause: dto.clause,
        severity: dto.severity,
        desc: dto.desc,
        photos: dto.photos ?? [],
        status: 'open',
        history: [{ at: now, action: '手动登记问题', by: shortName(user.name) }],
        responsible: null,
        deadline: null,
        createdAt: now,
        updatedAt: now,
      });
      await issuesRepo.save(issue);
      if (point.status !== 'closed' && point.status !== 'blocked') {
        point.status = 'issue';
        point.updatedAt = now;
        await points.save(point);
      }
      return issue;
    });
  }

  /** 状态机推进：角色校验、history/photos 追加、点位联动（与原型 ADVANCE_ISSUE 一致） */
  async advance(user: AuthUser, id: string, dto: AdvanceIssueDto) {
    return this.dataSource.transaction(async (em) => {
      const issuesRepo = em.getRepository(IssueEntity);
      const points = em.getRepository(PointEntity);

      const issue = await issuesRepo.findOne({
        where: { id, orgId: user.orgId! },
      });
      if (!issue) throw new NotFoundException('问题单不存在');

      const from = issue.status;
      const to = dto.to ?? DEFAULT_NEXT[from];
      if (!to) {
        throw new UnprocessableEntityException('问题单已闭环，不可再流转');
      }
      const t = TRANSITIONS[`${from}>${to}`];
      if (!t) {
        throw new UnprocessableEntityException(
          `不支持的状态流转：${from} → ${to}`,
        );
      }
      if (!hasRole(user, t.roles)) {
        throw new ForbiddenException('当前角色无权执行该流转');
      }
      // 暂不立案必须填写补充说明
      if (to === 'deferred' && !dto.note?.trim()) {
        throw new UnprocessableEntityException('暂不立案需填写补充说明');
      }

      const now = nowIso();
      issue.status = to;
      issue.history = [
        ...issue.history,
        {
          at: now,
          action: dto.action ?? t.action,
          by: shortName(user.name),
          ...(dto.note ? { note: dto.note } : {}),
        },
      ];
      if (dto.photos?.length) issue.photos = [...issue.photos, ...dto.photos];
      // open → assigned 可带 responsible/deadline 写入问题单
      if (to === 'assigned') {
        if (dto.responsible !== undefined) issue.responsible = dto.responsible;
        if (dto.deadline !== undefined) issue.deadline = dto.deadline;
      }
      issue.updatedAt = now;
      await issuesRepo.save(issue);

      // 点位联动（与原型 ADVANCE_ISSUE 一致，契约补充 recheck→fixing 退回）
      const point = await points.findOne({ where: { id: issue.pointId } });
      if (point) {
        if (to === 'closed') {
          // 该点位无其他未闭环问题单（不含"暂不立案"）→ 点位 closed
          const openRest = await issuesRepo.count({
            where: { pointId: point.id, status: Not(In(['closed', 'deferred'])) },
          });
          if (openRest === 0) {
            point.status = 'closed';
            point.updatedAt = now;
            await points.save(point);
          }
        } else if (to === 'recheck') {
          point.status = 'recheck';
          point.updatedAt = now;
          await points.save(point);
        } else if (to === 'fixing' && from === 'recheck') {
          // 复查不通过，退回整改 → 点位 issue
          point.status = 'issue';
          point.updatedAt = now;
          await points.save(point);
        }
      }

      return issue;
    });
  }
}
