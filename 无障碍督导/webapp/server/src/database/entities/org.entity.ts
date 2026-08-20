import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('orgs')
export class OrgEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  name: string;

  @Column('text')
  orgType: string;

  @Column('text')
  regionName: string;

  /** [lat, lng] */
  @Column('simple-json')
  center: [number, number];

  /** [[minLat,minLng],[maxLat,maxLng]] */
  @Column('simple-json')
  bounds: [[number, number], [number, number]];

  @Column('text', { default: 'active' })
  status: 'active' | 'disabled';

  @Column('text', { nullable: true })
  expiresAt: string | null;
}
