import { Column, Entity, PrimaryColumn } from 'typeorm';

export type TaskStatus = 'pool' | 'todo' | 'doing' | 'done' | 'blocked';

@Entity('tasks')
export class TaskEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  orgId: string;

  @Column('text')
  pointId: string;

  @Column('text')
  title: string;

  @Column('text')
  deadline: string;

  @Column('text')
  mode: 'pool' | 'assign';

  @Column('text', { nullable: true })
  assigneeId: string | null;

  @Column('text', { default: 'pool' })
  status: TaskStatus;

  @Column('text')
  createdAt: string;

  @Column('text', { nullable: true })
  claimedAt: string | null;

  @Column('text', { nullable: true })
  startedAt: string | null;

  @Column('text', { nullable: true })
  finishedAt: string | null;

  @Column('float', { nullable: true })
  startLat: number | null;

  @Column('float', { nullable: true })
  startLng: number | null;

  @Column('float', { nullable: true })
  startDistance: number | null;

  /** 任务过程事件（退回补充等；创建/领取/签到/提交由状态字段推导，不重复记录） */
  @Column('simple-json', { nullable: true })
  log?: { at: string; event: string; by?: string | null }[];
}
