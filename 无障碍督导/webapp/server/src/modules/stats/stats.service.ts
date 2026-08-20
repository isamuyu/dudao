import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  InspectionEntity,
  IssueEntity,
  PointEntity,
  PointStatus,
} from '../../database/entities';
import { AuthUser } from '../../common/decorators';
import { BUILDING_SUBTYPES } from '../../checklib/checklib';

const INSPECTED: PointStatus[] = [
  'inspecting',
  'issue',
  'recheck',
  'closed',
  'blocked',
];
const STAR_SUBTYPES = new Set(
  BUILDING_SUBTYPES.filter((s) => s.star).map((s) => s.id),
);

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(PointEntity)
    private readonly points: Repository<PointEntity>,
    @InjectRepository(IssueEntity)
    private readonly issues: Repository<IssueEntity>,
    @InjectRepository(InspectionEntity)
    private readonly inspections: Repository<InspectionEntity>,
  ) {}

  /**
   * org 内统计；platform_admin 传 orgId 指定，缺省为全局汇总。
   * campaignId：按督导行动筛选（点位/检查记录/问题单均限定在该行动的点位范围内）。
   */
  async overview(user: AuthUser, orgId?: string, campaignId?: string) {
    const scoped = user.role === 'platform_admin' ? orgId : user.orgId!;
    const baseWhere = {
      ...(scoped ? { orgId: scoped } : {}),
      ...(campaignId ? { campaignId } : {}),
    };
    const points = await this.points.find({ where: baseWhere });
    const pointIds = points.map((p) => p.id);
    const childWhere = {
      ...(scoped ? { orgId: scoped } : {}),
      ...(campaignId ? { pointId: In(pointIds.length ? pointIds : ['__none__']) } : {}),
    };
    const [issues, inspections] = await Promise.all([
      this.issues.find({ where: childWhere }),
      this.inspections.find({ where: childWhere }),
    ]);

    const countBy = <T extends string>(list: { status: T }[]) => {
      const m = new Map<T, number>();
      for (const x of list) m.set(x.status, (m.get(x.status) ?? 0) + 1);
      return [...m.entries()].map(([status, count]) => ({ status, count }));
    };
    const byFacility = new Map<string, number>();
    for (const i of issues)
      byFacility.set(i.facility, (byFacility.get(i.facility) ?? 0) + 1);

    /** ===== 各类设施达标率（检查点判定 pass/fail + 问题单闭环） ===== */
    const facChecks = new Map<string, { pass: number; fail: number }>();
    for (const insp of inspections) {
      for (const ins of insp.instances ?? []) {
        if (ins.applicable === false) continue; // "本处不涉及"不参与达标统计
        const e = facChecks.get(ins.facility) ?? { pass: 0, fail: 0 };
        for (const c of Object.values(ins.checks ?? {})) {
          if (c.verdict === 'pass') e.pass++;
          else if (c.verdict === 'fail') e.fail++;
        }
        facChecks.set(ins.facility, e);
      }
    }
    const facIssues = new Map<string, { total: number; closed: number }>();
    for (const i of issues) {
      const e = facIssues.get(i.facility) ?? { total: 0, closed: 0 };
      e.total++;
      if (i.status === 'closed') e.closed++;
      facIssues.set(i.facility, e);
    }
    const facilityStats = [...new Set([...facChecks.keys(), ...facIssues.keys()])]
      .map((facility) => {
        const c = facChecks.get(facility);
        const is = facIssues.get(facility);
        const checked = (c?.pass ?? 0) + (c?.fail ?? 0);
        return {
          facility,
          checked,
          pass: c?.pass ?? 0,
          fail: c?.fail ?? 0,
          rate: checked > 0 ? Math.round(((c?.pass ?? 0) / checked) * 100) : null,
          issues: is?.total ?? 0,
          issuesClosed: is?.closed ?? 0,
        };
      })
      .sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101) || b.issues - a.issues);

    /** ===== 各类型建筑/道路达标情况 ===== */
    const issuesByPoint = new Map<string, { total: number; closed: number }>();
    for (const i of issues) {
      if (i.status === 'deferred') continue; // 暂不立案不计入点位达标判定
      const e = issuesByPoint.get(i.pointId) ?? { total: 0, closed: 0 };
      e.total++;
      if (i.status === 'closed') e.closed++;
      issuesByPoint.set(i.pointId, e);
    }
    const subMap = new Map<
      string,
      { points: number; inspected: number; qualified: number; issues: number; issuesClosed: number }
    >();
    for (const p of points) {
      const e =
        subMap.get(p.subtypeId) ?? { points: 0, inspected: 0, qualified: 0, issues: 0, issuesClosed: 0 };
      e.points++;
      const pi = issuesByPoint.get(p.id);
      e.issues += pi?.total ?? 0;
      e.issuesClosed += pi?.closed ?? 0;
      if (INSPECTED.includes(p.status)) {
        e.inspected++;
        // 达标：已督导且无未闭环问题
        if ((pi?.total ?? 0) - (pi?.closed ?? 0) === 0) e.qualified++;
      }
      subMap.set(p.subtypeId, e);
    }
    const subtypeStats = [...subMap.entries()]
      .map(([subtypeId, e]) => ({
        subtypeId,
        ...e,
        qualifiedRate: e.inspected > 0 ? Math.round((e.qualified / e.inspected) * 100) : null,
      }))
      .sort((a, b) => b.points - a.points);

    /** ===== 整改落实情况（"暂不立案"不参与整改统计） ===== */
    const activeIssues = issues.filter((i) => i.status !== 'deferred');
    const closedIssues = activeIssues.filter((i) => i.status === 'closed');
    const durations = closedIssues
      .map((i) => (Date.parse(i.updatedAt) - Date.parse(i.createdAt)) / 86400000)
      .filter((d) => Number.isFinite(d) && d >= 0);
    const today = new Date().toISOString().slice(0, 10);
    const rectification = {
      total: activeIssues.length,
      closed: closedIssues.length,
      closeRate: activeIssues.length > 0 ? Math.round((closedIssues.length / activeIssues.length) * 100) : null,
      avgCloseDays:
        durations.length > 0
          ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
          : null,
      overdue: activeIssues.filter(
        (i) => i.status !== 'closed' && !!i.deadline && i.deadline < today,
      ).length,
      bySeverity: (['M', 'C', 'R'] as const).map((severity) => {
        const list = activeIssues.filter((i) => i.severity === severity);
        return {
          severity,
          total: list.length,
          closed: list.filter((i) => i.status === 'closed').length,
        };
      }),
    };

    return {
      pointsTotal: points.length,
      inspectedPoints: points.filter((p) => INSPECTED.includes(p.status)).length,
      issuesTotal: issues.length,
      issuesClosed: closedIssues.length,
      pointsByStatus: countBy(points),
      issuesByStatus: countBy(issues),
      issuesByFacility: [...byFacility.entries()].map(([facility, count]) => ({
        facility,
        count,
      })),
      starPoints: points
        .filter((p) => STAR_SUBTYPES.has(p.subtypeId))
        .map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          subtypeId: p.subtypeId,
        })),
      facilityStats,
      subtypeStats,
      rectification,
    };
  }
}
