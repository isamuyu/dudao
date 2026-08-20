import { Column, Entity, PrimaryColumn } from 'typeorm';

export interface AspectResult {
  measured?: string;
  verdict?: 'pass' | 'fail';
}

/** 督导员现场补充的自定义条款（用于"其他无障碍设施"实例） */
export interface CustomItem {
  key: string;
  aspect: string;
  requirement: string;
}

export interface InstanceResult {
  id: string;
  facility: string;
  no: number;
  locationDesc: string;
  applicable?: boolean;
  checks: Record<string, AspectResult>;
  customItems?: CustomItem[];
  note?: string;
  photos?: string[];
}

export interface MainInfo {
  floors: string;
  nature: string;
  contact: string;
  contactPhone: string;
  collectStatus: string;
  note: string;
  photos: string[]; // 建筑现场照片 fileId
}

@Entity('inspections')
export class InspectionEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  orgId: string;

  @Column('text')
  taskId: string;

  @Column('text')
  pointId: string;

  @Column('text')
  inspectorId: string;

  @Column('text')
  inspectorName: string;

  @Column('simple-json')
  mainInfo: MainInfo;

  @Column('simple-json')
  instances: InstanceResult[];

  /** 条件设置(C)缺失设施中，督导员现场确认"触发条件已满足"的设施 id 列表（仅这些生成问题单） */
  @Column('simple-json', { nullable: true })
  condTriggered?: string[];

  /** 本次检查采用的检查项配置版本 id */
  @Column('text', { nullable: true })
  profileId?: string;

  @Column('text')
  checklibVersion: string;

  @Column('text')
  submittedAt: string;
}
