import { Column, Entity, PrimaryColumn } from 'typeorm';
import { Bounds } from '../../common/geo';

@Entity('campaigns')
export class CampaignEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  orgId: string;

  @Column('text')
  name: string;

  @Column('text')
  regionDesc: string;

  /** 两角框选的大致区域，可为空 */
  @Column('simple-json', { nullable: true })
  bounds: Bounds | null;

  @Column('text')
  createdBy: string;

  @Column('text')
  createdAt: string;

  @Column('text', { default: 'active' })
  status: 'active' | 'done';
}
