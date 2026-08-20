/** 纯工具模块：类型 re-export（源自 API 契约）+ 状态元数据 + 地理工具函数 */
import type { Org, PointStatus, IssueStatus } from '@/api/types'

export type {
  Role, User, Org, Campaign, ObjectKind, Point, PointStatus, PointChangeLog,
  Task, TaskStatus, Issue, IssueStatus, IssueHistory,
  AspectResult, InstanceResult, MainInfo, Inspection, FileMeta, StatsOverview,
} from '@/api/types'

export const POINT_STATUS_META: Record<PointStatus, { label: string; color: string }> = {
  pending: { label: '未督导', color: '#64748b' },
  inspecting: { label: '督导中', color: '#0ea5e9' },
  issue: { label: '待闭环', color: '#ef4444' },
  recheck: { label: '复查中', color: '#f59e0b' },
  closed: { label: '已闭环', color: '#22c55e' },
  blocked: { label: '无法督导', color: '#a855f7' },
}

export const ISSUE_STATUS_META: Record<IssueStatus, string> = {
  open: '待立案', deferred: '暂不立案', assigned: '已派单', fixing: '整改中', recheck: '待复查', closed: '已闭环',
}

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`

export function inRegion(org: Pick<Org, 'bounds'>, lat: number, lng: number) {
  return lat >= org.bounds[0][0] && lat <= org.bounds[1][0] && lng >= org.bounds[0][1] && lng <= org.bounds[1][1]
}

export function inBounds(bounds: [[number, number], [number, number]] | null, lat: number, lng: number) {
  if (!bounds) return true
  return lat >= bounds[0][0] && lat <= bounds[1][0] && lng >= bounds[0][1] && lng <= bounds[1][1]
}

/** 两点距离（米），道路线段长度示意 */
export function distM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}
