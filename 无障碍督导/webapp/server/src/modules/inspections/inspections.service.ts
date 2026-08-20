import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Not, Repository } from 'typeorm';
import {
  CampaignEntity,
  InspectionEntity,
  IssueEntity,
  CheckProfileEntity,
  PointEntity,
  PointStatus,
  TaskEntity,
} from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { nowIso, shortName, uid } from '../../common/geo';
import { config } from '../../config';
import { buildFacilityRowsFrom, facilityNameFrom } from '../../checklib/checklib';
import { DEFAULT_PROFILE_ID } from '../checklib/check-profiles.controller';
import { CreateInspectionDto } from './dto';

@Injectable()
export class InspectionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(InspectionEntity)
    private readonly inspections: Repository<InspectionEntity>,
  ) {}

  /**
   * 提交检查记录：与原型 InspectPage.submit() + SUBMIT_INSPECTION reducer 完全一致。
   * 缺失设施 / 不合格检查点 → 自动生成问题单；联动任务与点位状态。
   */
  async submit(user: AuthUser, dto: CreateInspectionDto) {
    return this.dataSource.transaction(async (em) => {
      const tasks = em.getRepository(TaskEntity);
      const points = em.getRepository(PointEntity);
      const inspectionsRepo = em.getRepository(InspectionEntity);
      const issuesRepo = em.getRepository(IssueEntity);

      // 1. 校验任务属本组织、状态 todo/doing
      const task = await tasks.findOne({
        where: { id: dto.taskId, orgId: user.orgId! },
      });
      if (!task) throw new NotFoundException('任务不存在');
      if (task.status !== 'todo' && task.status !== 'doing') {
        throw new UnprocessableEntityException('任务当前状态不可提交检查记录');
      }
      const point = await points.findOne({ where: { id: task.pointId } });
      if (!point) throw new NotFoundException('点位不存在');

      const now = nowIso();
      const by = shortName(user.name);
      const blocked = dto.mainInfo.collectStatus !== 'ok';
      const newIssues: IssueEntity[] = [];
      const inspectionId = uid('r');
      let replaced = 0; // 重新督导时被替换的未闭环问题单数
      let profileId: string | undefined; // 本次检查采用的检查项配置

      if (!blocked) {
        // 重新督导提交：以往检查生成且未闭环的问题单全部按最新结果更新（替换）；已闭环的原样保留
        const prevInspections = await inspectionsRepo.find({
          where: { taskId: task.id, orgId: point.orgId },
        });
        const prevIds = prevInspections.map((i) => i.id);
        if (prevIds.length > 0) {
          const stale = await issuesRepo.find({
            where: { inspectionId: In(prevIds), status: Not('closed') },
          });
          replaced = stale.length;
          if (replaced > 0) await issuesRepo.remove(stale);
        }

        // 按点位所属行动选用的检查项配置生成核查表（缺省默认配置）
        const campaign = point.campaignId
          ? await em.getRepository(CampaignEntity).findOne({ where: { id: point.campaignId } })
          : null;
        profileId = campaign?.profileId ?? DEFAULT_PROFILE_ID;
        const profile = await em
          .getRepository(CheckProfileEntity)
          .findOne({ where: { id: profileId } });
        const lib = profile?.payload;
        const fname = (id: string) => facilityNameFrom(lib, id);
        const facilityRows = buildFacilityRowsFrom(lib, point.subtypeId);
        const rowOf = Object.fromEntries(facilityRows.map((r) => [r.facility, r]));
        // 现场数量 = instances 中该设施的实例数
        const counts: Record<string, number> = {};
        for (const ins of dto.instances) {
          counts[ins.facility] = (counts[ins.facility] ?? 0) + 1;
        }

        // ① 必须项缺失（现场数量为 0）→ 问题单；条件项缺失仅当督导员现场确认触发条件已满足时立案
        const condTriggered = dto.condTriggered ?? [];
        const missing = facilityRows.filter(
          (r) =>
            (counts[r.facility] ?? 0) === 0 &&
            (r.level === 'M' || (r.level === 'C' && condTriggered.includes(r.facility))),
        );
        for (const row of missing) {
          newIssues.push(
            issuesRepo.create({
              id: uid('i'),
              orgId: point.orgId,
              pointId: point.id,
              inspectionId,
              facility: row.facility,
              title: `缺少${row.level === 'M' ? '必须设置的' : '条件设置的'}${fname(row.facility)}`,
              requirement: row.typeNote ?? row.items[0]?.requirement ?? '',
              clause: row.typeClause ?? row.items[0]?.clause ?? '',
              severity: row.level === 'M' ? 'M' : 'C',
              desc:
                row.level === 'M'
                  ? `按配置矩阵该建筑类型必须设置${fname(row.facility)}，现场未发现该设施。`
                  : `${fname(row.facility)}为条件设置项，督导员现场确认触发条件（${row.condition ?? '详见标准'}）已满足，但未设置该设施。`,
              photos: [],
              status: 'open',
              history: [
                { at: now, action: '现场检查发现（设施缺失），自动生成问题单', by },
              ],
              responsible: null,
              deadline: null,
              createdAt: now,
              updatedAt: now,
            }),
          );
        }

        // ② 设施检查点不符合（applicable===true 且 verdict==='fail'）→ 问题单
        for (const ins of dto.instances) {
          const row = rowOf[ins.facility];
          if (!row || ins.applicable !== true) continue;
          // 自定义条款（任意设施均可现场增补）与模板检查点合并判定；自定义条款一律按"建议改进"(R) 立案
          const allItems = [
            ...row.items,
            ...(ins.customItems ?? []).map((c) => ({
              key: c.key,
              aspect: c.aspect,
              requirement: c.requirement,
              clause: '督导员现场补充条款',
              level: 'R' as const,
            })),
          ];
          for (const item of allItems) {
            if (ins.checks?.[item.key]?.verdict !== 'fail') continue;
            const measured = ins.checks[item.key]?.measured;
            newIssues.push(
              issuesRepo.create({
                id: uid('i'),
                orgId: point.orgId,
                pointId: point.id,
                inspectionId,
                facility: ins.facility,
                title: `${fname(ins.facility)}·${item.aspect}不符合（${ins.locationDesc || `实例${ins.no}`}）`,
                requirement: item.requirement,
                clause: item.clause,
                severity: item.level,
                desc:
                  [measured ? `实测：${measured}` : '', ins.note || '']
                    .filter(Boolean)
                    .join('；') || '现场核查不符合标准要求',
                photos: [],
                status: 'open',
                history: [
                  { at: now, action: '现场检查发现，自动生成问题单', by },
                ],
                responsible: null,
                deadline: null,
                createdAt: now,
                updatedAt: now,
              }),
            );
          }
        }
      }

      // 4. 落库检查记录 + 批量问题单
      const inspection = inspectionsRepo.create({
        id: inspectionId,
        orgId: point.orgId,
        taskId: task.id,
        pointId: point.id,
        inspectorId: user.id,
        inspectorName: user.name,
        mainInfo: dto.mainInfo,
        instances: dto.instances,
        condTriggered: dto.condTriggered ?? [],
        profileId,
        checklibVersion: config.checklibVersion,
        submittedAt: now,
      });
      await inspectionsRepo.save(inspection);
      if (newIssues.length) await issuesRepo.save(newIssues);

      // 5. 联动：blocked → 任务/点位 blocked；否则任务 done，点位 issue/closed
      const pointStatus: PointStatus = blocked
        ? 'blocked'
        : newIssues.length > 0
          ? 'issue'
          : 'closed';
      task.status = blocked ? 'blocked' : 'done';
      task.finishedAt = now;
      // 任务日志留痕：重新督导导致的问题单更新
      if (replaced > 0) {
        task.log = [
          ...(task.log ?? []),
          { at: now, event: `重新督导提交：${replaced} 条未闭环问题单已按最新结果更新（已闭环问题单保留）`, by },
        ];
      }
      await tasks.save(task);
      point.status = pointStatus;
      point.updatedAt = now;
      await points.save(point);

      // 6. 返回 {inspection, issues}
      return { inspection, issues: newIssues };
    });
  }

  list(user: AuthUser, pointId?: string) {
    return this.inspections.find({
      where: { orgId: user.orgId!, ...(pointId ? { pointId } : {}) },
    });
  }

  async detail(user: AuthUser, id: string) {
    const inspection = await this.inspections.findOne({
      where: { id, orgId: user.orgId! },
    });
    if (!inspection) throw new NotFoundException('检查记录不存在');
    return inspection;
  }
}
