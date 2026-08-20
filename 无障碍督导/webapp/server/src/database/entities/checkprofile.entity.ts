import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { ChecklibPayload } from '../../checklib/checklib';

/** 检查项配置版本（如"督导员快速检查表"）：行动创建时选用，现场检查按其内容生成核查表 */
@Entity('check_profiles')
export class CheckProfileEntity {
  @PrimaryColumn('text')
  id: string;

  @Column('text')
  name: string;

  /** 配置说明（来源、适用范围等） */
  @Column('text', { default: '' })
  description: string;

  /** 配置内容（设施/矩阵/明细/检查点模板/参数补丁等全量快照） */
  @Column('simple-json')
  payload: ChecklibPayload;

  /** 是否内置配置 */
  @Column('boolean', { default: false })
  builtin: boolean;

  @Column('text')
  createdAt: string;
}
