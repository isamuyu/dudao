import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  InspectionEntity,
  IssueEntity,
  PointEntity,
  TaskEntity,
  UserEntity,
} from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { distM, nowIso, shortName, uid } from '../../common/geo';
import { CreateTaskDto, StartTaskDto } from './dto';

/** 签到允许范围（米） */
const START_RANGE_M = 200;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly tasks: Repository<TaskEntity>,
    @InjectRepository(PointEntity)
    private readonly points: Repository<PointEntity>,
    @InjectRepository(InspectionEntity)
    private readonly inspections: Repository<InspectionEntity>,
    @InjectRepository(IssueEntity)
    private readonly issues: Repository<IssueEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  list(user: AuthUser) {
    return this.tasks.find({ where: { orgId: user.orgId! } });
  }

  private async findTask(user: AuthUser, id: string): Promise<TaskEntity> {
    const task = await this.tasks.findOne({
      where: { id, orgId: user.orgId! },
    });
    if (!task) throw new NotFoundException('任务不存在');
    return task;
  }

  async create(user: AuthUser, dto: CreateTaskDto) {
    const point = await this.points.findOne({
      where: { id: dto.pointId, orgId: user.orgId! },
    });
    if (!point) throw new NotFoundException('点位不存在');
    const existing = await this.tasks.count({
      where: {
        pointId: dto.pointId,
        orgId: user.orgId!,
        status: In(['pool', 'todo', 'doing']),
      },
    });
    if (existing > 0) {
      throw new UnprocessableEntityException('该点位已有进行中的督导任务');
    }
    if (dto.mode === 'assign' && !dto.assigneeId) {
      throw new UnprocessableEntityException('指派模式必须指定督导员 assigneeId');
    }
    const entity = this.tasks.create({
      id: uid('t'),
      orgId: user.orgId!,
      pointId: dto.pointId,
      title: dto.title,
      deadline: dto.deadline,
      mode: dto.mode,
      assigneeId: dto.mode === 'assign' ? dto.assigneeId! : null,
      status: dto.mode === 'assign' ? 'todo' : 'pool',
      createdAt: nowIso(),
      claimedAt: null,
      startedAt: null,
      finishedAt: null,
      startLat: null,
      startLng: null,
      startDistance: null,
    });
    return this.tasks.save(entity);
  }

  /** pool → todo，领取人为当前用户 */
  async claim(user: AuthUser, id: string) {
    const task = await this.findTask(user, id);
    if (task.status !== 'pool') {
      throw new UnprocessableEntityException('任务已被领取或不在任务池中');
    }
    task.status = 'todo';
    task.assigneeId = user.id;
    task.claimedAt = nowIso();
    return this.tasks.save(task);
  }

  /** todo → doing；距点位 >200m 需 force 确认 */
  async start(user: AuthUser, id: string, dto: StartTaskDto) {
    const task = await this.findTask(user, id);
    if (task.assigneeId !== user.id) {
      throw new ForbiddenException('仅领取人本人可以开始任务');
    }
    if (task.status !== 'todo') {
      throw new UnprocessableEntityException('任务当前状态不可开始');
    }
    const point = await this.points.findOne({ where: { id: task.pointId } });
    if (!point) throw new NotFoundException('点位不存在');

    let distance: number | null = null;
    if (dto.lat != null && dto.lng != null) {
      distance = distM(dto.lat, dto.lng, point.lat, point.lng);
      if (distance > START_RANGE_M && !dto.force) {
        throw new UnprocessableEntityException({
          message: `您距点位约 ${distance}m，超出签到允许范围(200m)`,
          distance,
        });
      }
    }

    const now = nowIso();
    task.status = 'doing';
    task.startedAt = now;
    if (dto.lat != null) task.startLat = dto.lat;
    if (dto.lng != null) task.startLng = dto.lng;
    if (distance != null) task.startDistance = distance;
    // 联动：点位 → inspecting（与原型 START_TASK 一致）
    point.status = 'inspecting';
    point.updatedAt = now;
    await this.points.save(point);
    return this.tasks.save(task);
  }

  /** doing → todo（暂存退出；点位保持 inspecting，与原型一致） */
  async release(user: AuthUser, id: string) {
    const task = await this.findTask(user, id);
    if (task.assigneeId !== user.id) {
      throw new ForbiddenException('仅领取人本人可以退出任务');
    }
    if (task.status !== 'doing') {
      throw new UnprocessableEntityException('任务当前状态不可暂存退出');
    }
    task.status = 'todo';
    return this.tasks.save(task);
  }

  /**
   * 任务详情：任务 + 点位 + 检查记录 + 关联问题单 + 任务日志时间线
   * （创建 → 领取 → 现场签到 → 提交检查 → 结办 → 问题全部闭环）
   */
  async detail(user: AuthUser, id: string) {
    const task = await this.findTask(user, id);
    const point = await this.points.findOne({
      where: { id: task.pointId, orgId: user.orgId! },
    });
    if (!point) throw new NotFoundException('点位不存在');

    const inspections = await this.inspections.find({
      where: { taskId: id, orgId: user.orgId! },
    });
    const inspIds = inspections.map((i) => i.id);
    const issues = inspIds.length
      ? await this.issues.find({ where: { inspectionId: In(inspIds) } })
      : [];
    const assignee = task.assigneeId
      ? await this.users.findOne({ where: { id: task.assigneeId } })
      : null;
    const assigneeName = assignee ? shortName(assignee.name) : null;
    /** 报告落款联系人：督导人员（任务执行人）+ 评审人员（本组织管理员） */
    const admins = await this.users.find({
      where: { orgId: task.orgId, role: 'admin', status: 'active' },
    });
    const contacts = {
      inspector: assignee
        ? { name: shortName(assignee.name), phone: assignee.phone }
        : null,
      reviewers: admins.map((a) => ({ name: shortName(a.name), phone: a.phone })),
    };

    const log: { at: string; event: string; by?: string | null }[] = [];
    log.push({
      at: task.createdAt,
      event: `任务创建（${task.mode === 'pool' ? '任务池' : '指派'}，截止 ${task.deadline}）`,
    });
    if (task.claimedAt) {
      log.push({ at: task.claimedAt, event: '任务领取', by: assigneeName });
    }
    if (task.startedAt) {
      log.push({
        at: task.startedAt,
        event: `现场签到，开始督导${task.startDistance != null ? `（距点位约 ${Math.round(task.startDistance)}m）` : ''}`,
        by: assigneeName,
      });
    }
    for (const insp of [...inspections].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))) {
      const n = issues.filter((i) => i.inspectionId === insp.id).length;
      log.push({
        at: insp.submittedAt,
        event: `提交检查记录（设施实例 ${insp.instances.length} 个，生成问题单 ${n} 条）`,
        by: shortName(insp.inspectorName),
      });
    }
    if (task.finishedAt) {
      log.push({
        at: task.finishedAt,
        event: task.status === 'blocked' ? '按"无法督导"结办' : '督导任务完成结办',
        by: assigneeName,
      });
    }
    // 过程事件（管理员退回补充等，持久化在 task.log）
    for (const e of task.log ?? []) log.push(e);
    // 关联问题单流转记录（审核立案/派单/整改反馈/申请复查/复查通过/退回整改）
    for (const iss of issues) {
      for (const h of iss.history ?? []) {
        log.push({
          at: h.at,
          event: `问题单「${iss.title}」${h.action}${h.note ? `（${h.note}）` : ''}`,
          by: h.by,
        });
      }
    }
    if (issues.length > 0 && issues.every((i) => i.status === 'closed')) {
      const last = issues.map((i) => i.updatedAt).sort().slice(-1)[0];
      log.push({ at: last, event: '问题全部闭环销号' });
    }
    log.sort((a, b) => a.at.localeCompare(b.at));

    return { task, point, inspections, issues, log, contacts };
  }

  /** 组织管理员将已结办（done/blocked）任务退回编辑状态：督导员可重新进入补充核查 */
  async returnToDoing(user: AuthUser, id: string) {
    const task = await this.findTask(user, id);
    if (task.status !== 'done' && task.status !== 'blocked') {
      throw new UnprocessableEntityException('仅已结办的任务可退回编辑状态');
    }
    const prevStatus = task.status;
    task.status = 'doing';
    task.finishedAt = null;
    // 日志留痕：退回补充
    task.log = [
      ...(task.log ?? []),
      {
        at: nowIso(),
        event: `管理员退回：任务由${prevStatus === 'blocked' ? '"无法督导"结办' : '完成'}状态退回编辑状态，需补充核查`,
        by: shortName(user.name),
      },
    ];
    const point = await this.points.findOne({
      where: { id: task.pointId, orgId: user.orgId! },
    });
    if (point) {
      point.status = 'inspecting';
      point.updatedAt = nowIso();
      await this.points.save(point);
    }
    return this.tasks.save(task);
  }
}
