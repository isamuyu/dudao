import { OrgEntity } from './org.entity';
import { UserEntity } from './user.entity';
import { CampaignEntity } from './campaign.entity';
import { PointEntity } from './point.entity';
import { TaskEntity } from './task.entity';
import { IssueEntity } from './issue.entity';
import { InspectionEntity } from './inspection.entity';
import { FileEntity } from './file.entity';
import { CheckProfileEntity } from './checkprofile.entity';

export const ALL_ENTITIES = [
  OrgEntity,
  UserEntity,
  CampaignEntity,
  PointEntity,
  TaskEntity,
  IssueEntity,
  InspectionEntity,
  FileEntity,
  CheckProfileEntity,
];

export {
  OrgEntity,
  UserEntity,
  CampaignEntity,
  PointEntity,
  TaskEntity,
  IssueEntity,
  InspectionEntity,
  FileEntity,
  CheckProfileEntity,
};

export { toPublicUser } from './user.entity';
export type { PointStatus, ChangeLogEntry } from './point.entity';
export type { TaskStatus } from './task.entity';
export type { IssueStatus, IssueHistory } from './issue.entity';
export type {
  AspectResult,
  InstanceResult,
  MainInfo,
} from './inspection.entity';
