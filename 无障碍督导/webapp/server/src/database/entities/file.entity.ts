import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('files')
export class FileEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  orgId: string;

  @Column('text')
  filename: string;

  @Column('text')
  mime: string;

  @Column('int')
  size: number;

  @Column('text')
  uploadedBy: string;

  @Column('text')
  createdAt: string;
}
