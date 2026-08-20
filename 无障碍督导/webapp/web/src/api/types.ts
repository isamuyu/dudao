/** 与后端 API 契约（docs/api.md V1.0）一致的 DTO 定义 */

export type Role = 'platform_admin' | 'admin' | 'inspector'

export interface User {
  id: string
  orgId: string | null
  name: string
  phone: string
  role: Role
  status: 'active' | 'disabled'
  certNo?: string
  certExpiresAt?: string
}

export interface Org {
  id: string
  name: string
  orgType: string
  regionName: string
  center: [number, number]                            // [lat, lng]
  bounds: [[number, number], [number, number]]        // [[minLat,minLng],[maxLat,maxLng]]
  status: 'active' | 'disabled'
  expiresAt?: string
}

export interface Campaign {
  id: string
  orgId: string
  name: string
  regionDesc: string
  bounds?: [[number, number], [number, number]]
  createdBy: string
  createdAt: string
  status: 'active' | 'done'
  /** 检查项配置版本 id */
  profileId?: string
}

/** 检查项配置版本（meta；详情含 payload 全文，结构见 data/checklib ChecklibPayload） */
export interface CheckProfile {
  id: string
  name: string
  description: string
  builtin: boolean
  createdAt: string
  payload?: unknown
}

export type ObjectKind = 'building' | 'road'
export type PointStatus = 'pending' | 'inspecting' | 'issue' | 'recheck' | 'closed' | 'blocked'

export interface PointChangeLog {
  at: string
  by: string
  field: string
  from: unknown
  to: unknown
  reason?: string
}

export interface Point {
  id: string
  orgId: string
  campaignId: string
  kind: ObjectKind
  name: string
  address: string
  lat: number
  lng: number
  lat2?: number
  lng2?: number
  subtypeId: string
  nature: string
  owner: string
  contact: string
  status: PointStatus
  locked: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  changeLog: PointChangeLog[]
}

export type TaskStatus = 'pool' | 'todo' | 'doing' | 'done' | 'blocked'

export interface Task {
  id: string
  orgId: string
  pointId: string
  title: string
  deadline: string
  mode: 'pool' | 'assign'
  assigneeId?: string
  status: TaskStatus
  createdAt: string
  claimedAt?: string
  startedAt?: string
  finishedAt?: string
  startLat?: number
  startLng?: number
  startDistance?: number
}

export type IssueStatus = 'open' | 'deferred' | 'assigned' | 'fixing' | 'recheck' | 'closed'

export interface IssueHistory {
  at: string
  action: string
  by: string
  note?: string
}

export interface Issue {
  id: string
  orgId: string
  pointId: string
  inspectionId?: string
  facility: string
  title: string
  requirement: string
  clause: string
  severity: 'M' | 'C' | 'R'
  desc: string
  photos: string[]            // fileId
  status: IssueStatus
  history: IssueHistory[]
  responsible: string
  deadline: string
  createdAt: string
  updatedAt: string
}

export interface AspectResult {
  measured?: string
  verdict?: 'pass' | 'fail'
}

/** 督导员现场补充的自定义条款（用于"其他无障碍设施"实例） */
export interface CustomItem {
  key: string                 // 实例内唯一键，如 c-xxxxxx
  aspect: string              // 条款名称（如：无障碍饮水设施）
  requirement: string         // 条款内容/要求（用户自行录入）
}

export interface InstanceResult {
  id: string
  facility: string
  no: number
  locationDesc: string
  applicable?: boolean
  checks: Record<string, AspectResult>   // key = 检查点 key（设施#序号 或自定义条款 key）
  customItems?: CustomItem[]             // facility === 'other' 时的自定义条款
  note?: string
  photos?: string[]                      // fileId
}

export interface MainInfo {
  floors: string
  nature: string
  contact: string
  contactPhone: string
  collectStatus: string
  note: string
  photos: string[]             // 建筑现场照片 fileId
}

export interface Inspection {
  id: string
  orgId: string
  taskId: string
  pointId: string
  inspectorId: string
  inspectorName: string
  mainInfo: MainInfo
  instances: InstanceResult[]
  condTriggered?: string[]
  /** 本次检查采用的检查项配置版本 id */
  profileId?: string
  checklibVersion: string
  submittedAt: string
}

/** 任务日志时间线条目 */
export interface TaskLogEntry {
  at: string
  event: string
  by?: string | null
}

/** GET /tasks/:id 详情（任务 + 点位 + 检查记录 + 问题单 + 日志 + 落款联系人） */
export interface TaskDetail {
  task: Task
  point: Point
  inspections: Inspection[]
  issues: Issue[]
  log: TaskLogEntry[]
  contacts?: {
    inspector: { name: string; phone: string } | null
    reviewers: { name: string; phone: string }[]
  }
}

/** 设施达标统计项 */
export interface FacilityStat {
  facility: string
  checked: number        // 已判定检查点数
  pass: number
  fail: number
  rate: number | null    // 检查点达标率 %
  issues: number
  issuesClosed: number
}

/** 建筑/道路类型达标统计项 */
export interface SubtypeStat {
  subtypeId: string
  points: number
  inspected: number
  qualified: number      // 已督导且无未闭环问题的点位数
  qualifiedRate: number | null
  issues: number
  issuesClosed: number
}

/** 整改落实情况 */
export interface RectificationStats {
  total: number
  closed: number
  closeRate: number | null
  avgCloseDays: number | null
  overdue: number        // 超整改期限仍未闭环
  bySeverity: { severity: 'M' | 'C' | 'R'; total: number; closed: number }[]
}

export interface FileMeta {
  id: string
  orgId: string
  filename: string
  mime: string
  size: number
  uploadedBy: string
  createdAt: string
}

export interface StatsOverview {
  pointsTotal: number
  inspectedPoints: number
  issuesTotal: number
  issuesClosed: number
  pointsByStatus: { status: PointStatus; count: number }[]
  issuesByStatus: { status: IssueStatus; count: number }[]
  issuesByFacility: { facility: string; count: number }[]
  starPoints: { id: string; name: string; status: PointStatus; subtypeId: string }[]
  facilityStats: FacilityStat[]
  subtypeStats: SubtypeStat[]
  rectification: RectificationStats
}

/** POST /auth/login 响应 */
export interface LoginResponse {
  token: string
  user: User
  org: Org | null
}

/** GET /auth/me 响应 */
export interface MeResponse {
  user: User
  org: Org | null
}

/** POST /inspections 响应 */
export interface SubmitInspectionResponse {
  inspection: Inspection
  issues: Issue[]
}

/** POST /files/presign 响应 */
export interface PresignResponse {
  file: FileMeta
  uploadUrl: string
}
