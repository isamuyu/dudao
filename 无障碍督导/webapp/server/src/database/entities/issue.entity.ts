import { Column, Entity, PrimaryColumn } from 'typeorm';

export type IssueStatus = 'open' | 'deferred' | 'assigned' | 'fixing' | 'recheck' | 'closed';

export interface IssueHistory {
  at: string;
  action: string;
  by: string;
  note?: string;
}

@Entity('issues')
export class IssueEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  orgId: string;

  @Column('text')
  pointId: string;

  /** 自动生成问题单来源的检查记录 */
  @Column('text', { nullable: true })
  inspectionId: string | null;

  @Column('text')
  facility: string;

  @Column('text')
  title: string;

  @Column('text')
  requirement: string;

  @Column('text')
  clause: string;

  @Column('text')
  severity: 'M' | 'C' | 'R';

  @Column('text')
  desc: string;

  /** fileId 列表 */
  @Column('simple-json')
  photos: string[];

  @Column('text', { default: 'open' })
  status: IssueStatus;

  @Column('simple-json')
  history: IssueHistory[];

  @Column('text', { nullable: true })
  responsible: string | null;

  @Column('text', { nullable: true })
  deadline: string | null;

  @Column('text')
  createdAt: string;

  @Column('text')
  updatedAt: string;
}
