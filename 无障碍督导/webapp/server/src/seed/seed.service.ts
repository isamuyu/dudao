import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityTarget, ObjectLiteral } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  OrgEntity,
  UserEntity,
  CampaignEntity,
  PointEntity,
  TaskEntity,
  IssueEntity,
  InspectionEntity,
  FileEntity,
} from '../database/entities';

const T0 = '2026-08-15T00:00:00.000Z';

/**
 * 种子数据：完全复刻原型 src/store/app.tsx 的 seed
 * （2 组织 / 4 用户 + platform_admin / 3 行动 / 12 点位 / 7 任务 / 3 问题单，密码统一 123456）
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrgEntity) private readonly orgs: Repository<OrgEntity>,
  ) {}

  async onApplicationBootstrap() {
    const n = await this.orgs.count();
    if (n === 0) {
      this.logger.log('orgs 表为空，执行初始化种子…');
      await this.reseed();
      this.logger.log('种子完成');
    }
  }

  /** 清空全部业务数据并重新种子化（POST /admin/reseed 与启动自检共用） */
  async reseed(): Promise<void> {
    const tables: EntityTarget<ObjectLiteral>[] = [
      FileEntity,
      InspectionEntity,
      IssueEntity,
      TaskEntity,
      PointEntity,
      CampaignEntity,
      UserEntity,
      OrgEntity,
    ];
    for (const t of tables) await this.dataSource.getRepository(t).clear();

    const hash = bcrypt.hashSync('123456', 10);

    await this.dataSource.getRepository(OrgEntity).save([
      { id: 'org-hz', name: '杭州市西湖区无障碍督导队', orgType: '残联督导队', regionName: '杭州市西湖区', center: [30.245, 120.125], bounds: [[30.19, 120.05], [30.3, 120.2]], status: 'active', expiresAt: null },
      { id: 'org-cd', name: '成都市锦江区无障碍督导站', orgType: '第三方督导机构', regionName: '成都市锦江区', center: [30.656, 104.081], bounds: [[30.6, 104.03], [30.71, 104.13]], status: 'active', expiresAt: null },
    ]);

    await this.dataSource.getRepository(UserEntity).save([
      { id: 'u-platform-admin', orgId: null, name: '平台管理员', phone: '13900000000', role: 'platform_admin', status: 'active', certNo: null, certExpiresAt: null, passwordHash: hash },
      { id: 'u-hz-admin', orgId: 'org-hz', name: '王敏（组织管理员）', phone: '13800000001', role: 'admin', status: 'active', certNo: null, certExpiresAt: null, passwordHash: hash },
      { id: 'u-hz-insp', orgId: 'org-hz', name: '李强（督导员）', phone: '13800000002', role: 'inspector', status: 'active', certNo: null, certExpiresAt: null, passwordHash: hash },
      { id: 'u-cd-admin', orgId: 'org-cd', name: '陈芳（组织管理员）', phone: '13800000003', role: 'admin', status: 'active', certNo: null, certExpiresAt: null, passwordHash: hash },
      { id: 'u-cd-insp', orgId: 'org-cd', name: '赵磊（督导员）', phone: '13800000004', role: 'inspector', status: 'active', certNo: null, certExpiresAt: null, passwordHash: hash },
    ]);

    await this.dataSource.getRepository(CampaignEntity).save([
      { id: 'c1', orgId: 'org-hz', name: '西湖区 2026 秋季无障碍专项督导行动', regionDesc: '文二西路—曙光路—天目山路片区', bounds: [[30.24, 120.06], [30.295, 120.15]], createdBy: '王敏', createdAt: '2026-08-15', status: 'active' },
      { id: 'c2', orgId: 'org-hz', name: '交通枢纽无障碍督导行动', regionDesc: '地铁 2 号线沿线', bounds: [[30.27, 120.09], [30.3, 120.12]], createdBy: '王敏', createdAt: '2026-08-12', status: 'active' },
      { id: 'c3', orgId: 'org-cd', name: '锦江区政务与医疗无障碍督导行动', regionDesc: '金石路—成龙大道片区', bounds: [[30.585, 104.085], [30.605, 104.12]], createdBy: '陈芳', createdAt: '2026-08-14', status: 'active' },
    ]);

    const pt = (p: Partial<PointEntity> & { id: string }): PointEntity =>
      ({
        createdAt: T0,
        updatedAt: T0,
        changeLog: [],
        ...p,
      }) as PointEntity;

    await this.dataSource.getRepository(PointEntity).save([
      pt({ id: 'p1', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '西湖区政务服务中心', address: '西湖区竞舟路228号', lat: 30.2466, lng: 120.118, subtypeId: 'gov', nature: '既有', owner: '西湖区行政审批服务管理办公室', contact: '0571-88000001', status: 'issue', locked: true, createdBy: '王敏' }),
      pt({ id: 'p2', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '西湖区图书馆', address: '西湖区古墩路413号', lat: 30.282, lng: 120.101, subtypeId: 'library', nature: '既有', owner: '西湖区文化和广电旅游体育局', contact: '0571-88000002', status: 'pending', locked: true, createdBy: '王敏' }),
      pt({ id: 'p3', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '绿城·桂花城小区', address: '西湖区文二西路698号', lat: 30.272, lng: 120.092, subtypeId: 'house', nature: '既有', owner: '绿城物业服务集团', contact: '0571-88000003', status: 'pending', locked: true, createdBy: '王敏' }),
      pt({ id: 'p4', orgId: 'org-hz', campaignId: 'c2', kind: 'building', name: '地铁2号线文新站', address: '西湖区文二西路与古墩路交叉口', lat: 30.285, lng: 120.099, subtypeId: 'metro', nature: '既有', owner: '杭州市地铁集团', contact: '0571-88000004', status: 'pending', locked: true, createdBy: '王敏' }),
      pt({ id: 'p5', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '杭州黄龙饭店', address: '西湖区曙光路120号', lat: 30.262, lng: 120.133, subtypeId: 'hotel', nature: '改建', owner: '黄龙饭店有限公司', contact: '0571-88000005', status: 'closed', locked: true, createdBy: '王敏' }),
      pt({ id: 'p6', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '黄龙体育中心', address: '西湖区黄龙路1号', lat: 30.268, lng: 120.127, subtypeId: 'stadium', nature: '既有', owner: '浙江省黄龙体育中心', contact: '0571-88000006', status: 'pending', locked: true, createdBy: '王敏' }),
      pt({ id: 'p7', orgId: 'org-hz', campaignId: 'c1', kind: 'road', name: '文三路人行道（古荡段）', address: '文三路（古翠路—丰潭路段）北侧', lat: 30.279, lng: 120.108, lat2: 30.2796, lng2: 120.115, subtypeId: 'road', nature: '既有', owner: '西湖区城管局', contact: '0571-88000007', status: 'pending', locked: true, createdBy: '王敏' }),
      pt({ id: 'p11', orgId: 'org-hz', campaignId: 'c1', kind: 'road', name: '曙光路盲道（黄龙段）', address: '曙光路（黄龙路口—浙图路口）东侧', lat: 30.2598, lng: 120.1295, lat2: 30.2642, lng2: 120.1355, subtypeId: 'road', nature: '既有', owner: '西湖区城管局', contact: '0571-88000009', status: 'pending', locked: true, createdBy: '王敏' }),
      pt({ id: 'p8', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '西溪湿地周家村出入口广场', address: '西湖区天目山路518号', lat: 30.266, lng: 120.068, subtypeId: 'square', nature: '既有', owner: '西溪湿地管委会', contact: '0571-88000008', status: 'pending', locked: true, createdBy: '王敏' }),
      pt({ id: 'p9', orgId: 'org-cd', campaignId: 'c3', kind: 'building', name: '锦江区政务服务中心', address: '锦江区金石路166号', lat: 30.598, lng: 104.095, subtypeId: 'gov', nature: '既有', owner: '锦江区行政审批局', contact: '028-86000001', status: 'pending', locked: true, createdBy: '陈芳' }),
      pt({ id: 'p10', orgId: 'org-cd', campaignId: 'c3', kind: 'building', name: '四川大学华西第二医院锦江院区', address: '锦江区成龙大道一段1416号', lat: 30.59, lng: 104.11, subtypeId: 'hospital', nature: '新建', owner: '华西第二医院', contact: '028-86000002', status: 'pending', locked: true, createdBy: '陈芳' }),
      pt({ id: 'p12', orgId: 'org-cd', campaignId: 'c3', kind: 'road', name: '成龙大道人行道（华西段）', address: '成龙大道一段北侧', lat: 30.5915, lng: 104.106, lat2: 30.5935, lng2: 104.113, subtypeId: 'road', nature: '既有', owner: '锦江区住建交局', contact: '028-86000003', status: 'pending', locked: true, createdBy: '陈芳' }),
    ]);

    const tk = (t: Partial<TaskEntity> & { id: string }): TaskEntity =>
      ({ createdAt: T0, ...t }) as TaskEntity;

    await this.dataSource.getRepository(TaskEntity).save([
      tk({ id: 't1', orgId: 'org-hz', pointId: 'p1', title: '政务服务中心无障碍复查督导', deadline: '2026-08-25', mode: 'assign', assigneeId: 'u-hz-insp', status: 'doing' }),
      tk({ id: 't2', orgId: 'org-hz', pointId: 'p2', title: '图书馆无障碍设施督导', deadline: '2026-08-30', mode: 'pool', status: 'pool' }),
      tk({ id: 't3', orgId: 'org-hz', pointId: 'p4', title: '地铁站无障碍专项督导', deadline: '2026-08-28', mode: 'pool', status: 'pool' }),
      tk({ id: 't4', orgId: 'org-hz', pointId: 'p7', title: '文三路人行道专项督导', deadline: '2026-09-05', mode: 'pool', status: 'pool' }),
      tk({ id: 't5', orgId: 'org-hz', pointId: 'p5', title: '旅馆建筑无障碍督导', deadline: '2026-08-10', mode: 'assign', assigneeId: 'u-hz-insp', status: 'done' }),
      tk({ id: 't6', orgId: 'org-hz', pointId: 'p6', title: '体育场馆无障碍专项督导', deadline: '2026-09-02', mode: 'pool', status: 'pool' }),
      tk({ id: 't7', orgId: 'org-cd', pointId: 'p9', title: '政务大厅无障碍督导', deadline: '2026-08-29', mode: 'pool', status: 'pool' }),
    ]);

    await this.dataSource.getRepository(IssueEntity).save([
      {
        id: 'i1', orgId: 'org-hz', pointId: 'p1', inspectionId: null, facility: 'parking',
        title: '无障碍停车位宽度不足',
        requirement: '无障碍停车位宽≥3.50m、长≥6.00m，一侧设≥1.20m轮椅通道',
        clause: 'G19 §2.9.2, §2.9.5', severity: 'M',
        desc: '实测宽度3.10m，未达标；地面标识磨损不清。',
        photos: [], status: 'fixing',
        history: [
          { at: '2026-08-10 09:20', action: '现场检查发现，自动生成问题单', by: '李强' },
          { at: '2026-08-10 14:00', action: '组织管理员审核立案', by: '王敏' },
          { at: '2026-08-11 10:00', action: '派单至责任单位，限期2026-08-24前整改', by: '王敏' },
        ],
        responsible: null, deadline: null, createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z',
      },
      {
        id: 'i2', orgId: 'org-hz', pointId: 'p1', inspectionId: null, facility: 'lowdesk',
        title: '服务大厅低位服务台被占用',
        requirement: '对外服务窗口应设低位服务台，台面高0.70–0.75m，下部净空≥0.65m',
        clause: 'G63 §8.1.3', severity: 'M',
        desc: '低位服务台堆放宣传资料，膝部空间被遮挡。',
        photos: [], status: 'recheck',
        history: [
          { at: '2026-08-10 09:35', action: '现场检查发现，自动生成问题单', by: '李强' },
          { at: '2026-08-10 14:00', action: '审核立案并派单', by: '王敏' },
          { at: '2026-08-14 16:20', action: '责任单位反馈已整改，上传照片', by: '政务中心物业' },
        ],
        responsible: null, deadline: null, createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-14T00:00:00.000Z',
      },
      {
        id: 'i3', orgId: 'org-hz', pointId: 'p5', inspectionId: null, facility: 'toilet',
        title: '无障碍厕所紧急呼叫按钮缺失',
        requirement: '距坐便器0.40–0.50m处设紧急呼叫按钮',
        clause: 'G19 §3.1.4', severity: 'M',
        desc: '首层无障碍厕所未设紧急呼叫按钮。',
        photos: [], status: 'closed',
        history: [
          { at: '2026-08-05 10:00', action: '现场检查发现', by: '李强' },
          { at: '2026-08-05 15:00', action: '立案派单', by: '王敏' },
          { at: '2026-08-08 11:00', action: '整改反馈', by: '黄龙饭店工程部' },
          { at: '2026-08-09 09:40', action: '复查通过，闭环销号', by: '李强' },
        ],
        responsible: null, deadline: null, createdAt: '2026-08-05T00:00:00.000Z', updatedAt: '2026-08-09T00:00:00.000Z',
      },
    ]);
  }
}
