import { Column, Entity, PrimaryColumn } from 'typeorm';

export type PointStatus =
  | 'pending'
  | 'inspecting'
  | 'issue'
  | 'recheck'
  | 'closed'
  | 'blocked';

export interface ChangeLogEntry {
  at: string;
  by: string;
  field: string;
  from: unknown;
  to: unknown;
  reason?: string;
}

@Entity('points')
export class PointEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  orgId: string;

  @Column('text')
  campaignId: string;

  @Column('text')
  kind: 'building' | 'road';

  @Column('text')
  name: string;

  @Column('text')
  address: string;

  @Column('float')
  lat: number;

  @Column('float')
  lng: number;

  /** 道路线段终点 */
  @Column('float', { nullable: true })
  lat2: number | null;

  @Column('float', { nullable: true })
  lng2: number | null;

  @Column('text')
  subtypeId: string;

  @Column('text')
  nature: string;

  @Column('text')
  owner: string;

  @Column('text')
  contact: string;

  @Column('text', { default: 'pending' })
  status: PointStatus;

  @Column('boolean', { default: true })
  locked: boolean;

  @Column('text')
  createdBy: string;

  @Column('text')
  createdAt: string;

  @Column('text')
  updatedAt: string;

  @Column('simple-json')
  changeLog: ChangeLogEntry[];
}
