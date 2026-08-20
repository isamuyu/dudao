import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'

/** ===== 领域模型 ===== */
export interface Org {
  id: string; name: string; orgType: string
  regionName: string
  center: [number, number]           // [lat, lng]
  bounds: [[number, number], [number, number]] // [[minLat,minLng],[maxLat,maxLng]]
}
export interface User { id: string; orgId: string; name: string; role: 'admin' | 'inspector' }

/** 督导行动：一次专项行动，划定大致区域，区域内包含建筑（点位）与道路（线段） */
export interface Campaign {
  id: string; orgId: string; name: string
  regionDesc: string                                   // 区域文字描述
  bounds: [[number, number], [number, number]] | null  // 两角框选的大致区域
  createdBy: string; createdAt: string
  status: 'active' | 'done'
}

export type ObjectKind = 'building' | 'road'
export type PointStatus = 'pending' | 'inspecting' | 'issue' | 'recheck' | 'closed' | 'blocked'
export const POINT_STATUS_META: Record<PointStatus, { label: string; color: string }> = {
  pending: { label: '未督导', color: '#64748b' },
  inspecting: { label: '督导中', color: '#0ea5e9' },
  issue: { label: '待闭环', color: '#ef4444' },
  recheck: { label: '复查中', color: '#f59e0b' },
  closed: { label: '已闭环', color: '#22c55e' },
  blocked: { label: '无法采集', color: '#a855f7' },
}
/** 督导对象：建筑（点位）或道路（两点线段） */
export interface Point {
  id: string; orgId: string; campaignId: string
  kind: ObjectKind
  name: string; address: string
  lat: number; lng: number
  lat2?: number; lng2?: number        // 道路线段终点
  subtypeId: string
  nature: string; owner: string; contact: string
  status: PointStatus; locked: boolean; createdBy: string
}

export type TaskStatus = 'pool' | 'todo' | 'doing' | 'done' | 'blocked'
export interface Task {
  id: string; orgId: string; pointId: string; title: string
  deadline: string; mode: 'pool' | 'assign'
  assigneeId?: string; status: TaskStatus
}

export type IssueStatus = 'open' | 'assigned' | 'fixing' | 'recheck' | 'closed'
export const ISSUE_STATUS_META: Record<IssueStatus, string> = {
  open: '待立案', assigned: '已派单', fixing: '整改中', recheck: '待复查', closed: '已闭环',
}
export interface Issue {
  id: string; orgId: string; pointId: string; facility: string
  title: string; requirement: string; clause: string
  severity: 'M' | 'C' | 'R'; desc: string
  status: IssueStatus
  history: { at: string; action: string; by: string }[]
}

export interface AspectResult { measured?: string; verdict?: 'pass' | 'fail' }
export interface InstanceResult {
  id: string; facility: string; no: number; locationDesc: string
  applicable?: boolean
  checks: Record<string, AspectResult>   // key = 检查点 key（设施#序号）
  note?: string; photos?: string[]
}
export interface Inspection {
  id: string; orgId: string; taskId: string; pointId: string
  mainInfo: {
    floors: string; nature: string; contact: string; contactPhone: string
    collectStatus: string; note: string
    doorFace: string[]; panoOut: string[]; panoIn: string[]
  }
  instances: InstanceResult[]
  submittedAt: string
}

export interface AppState {
  orgs: Org[]; users: User[]
  campaigns: Campaign[]
  points: Point[]; tasks: Task[]; issues: Issue[]; inspections: Inspection[]
  currentOrgId: string; currentUserId: string
  activeTaskId: string | null
}

/** ===== 种子数据 ===== */
const seed: AppState = {
  orgs: [
    { id: 'org-hz', name: '杭州市西湖区无障碍督导队', orgType: '残联督导队', regionName: '杭州市西湖区', center: [30.245, 120.125], bounds: [[30.19, 120.05], [30.30, 120.20]] },
    { id: 'org-cd', name: '成都市锦江区无障碍督导站', orgType: '第三方督导机构', regionName: '成都市锦江区', center: [30.656, 104.081], bounds: [[30.60, 104.03], [30.71, 104.13]] },
  ],
  users: [
    { id: 'u-hz-admin', orgId: 'org-hz', name: '王敏（组织管理员）', role: 'admin' },
    { id: 'u-hz-insp', orgId: 'org-hz', name: '李强（督导员）', role: 'inspector' },
    { id: 'u-cd-admin', orgId: 'org-cd', name: '陈芳（组织管理员）', role: 'admin' },
    { id: 'u-cd-insp', orgId: 'org-cd', name: '赵磊（督导员）', role: 'inspector' },
  ],
  campaigns: [
    { id: 'c1', orgId: 'org-hz', name: '西湖区 2026 秋季无障碍专项督导行动', regionDesc: '文二西路—曙光路—天目山路片区', bounds: [[30.24, 120.06], [30.295, 120.15]], createdBy: '王敏', createdAt: '2026-08-15', status: 'active' },
    { id: 'c2', orgId: 'org-hz', name: '交通枢纽无障碍督导行动', regionDesc: '地铁 2 号线沿线', bounds: [[30.27, 120.09], [30.30, 120.12]], createdBy: '王敏', createdAt: '2026-08-12', status: 'active' },
    { id: 'c3', orgId: 'org-cd', name: '锦江区政务与医疗无障碍督导行动', regionDesc: '金石路—成龙大道片区', bounds: [[30.585, 104.085], [30.605, 104.12]], createdBy: '陈芳', createdAt: '2026-08-14', status: 'active' },
  ],
  points: [
    { id: 'p1', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '西湖区政务服务中心', address: '西湖区竞舟路228号', lat: 30.2466, lng: 120.1180, subtypeId: 'gov', nature: '既有', owner: '西湖区行政审批服务管理办公室', contact: '0571-88000001', status: 'issue', locked: true, createdBy: '王敏' },
    { id: 'p2', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '西湖区图书馆', address: '西湖区古墩路413号', lat: 30.2820, lng: 120.1010, subtypeId: 'library', nature: '既有', owner: '西湖区文化和广电旅游体育局', contact: '0571-88000002', status: 'pending', locked: true, createdBy: '王敏' },
    { id: 'p3', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '绿城·桂花城小区', address: '西湖区文二西路698号', lat: 30.2720, lng: 120.0920, subtypeId: 'house', nature: '既有', owner: '绿城物业服务集团', contact: '0571-88000003', status: 'pending', locked: true, createdBy: '王敏' },
    { id: 'p4', orgId: 'org-hz', campaignId: 'c2', kind: 'building', name: '地铁2号线文新站', address: '西湖区文二西路与古墩路交叉口', lat: 30.2850, lng: 120.0990, subtypeId: 'metro', nature: '既有', owner: '杭州市地铁集团', contact: '0571-88000004', status: 'pending', locked: true, createdBy: '王敏' },
    { id: 'p5', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '杭州黄龙饭店', address: '西湖区曙光路120号', lat: 30.2620, lng: 120.1330, subtypeId: 'hotel', nature: '改建', owner: '黄龙饭店有限公司', contact: '0571-88000005', status: 'closed', locked: true, createdBy: '王敏' },
    { id: 'p6', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '黄龙体育中心', address: '西湖区黄龙路1号', lat: 30.2680, lng: 120.1270, subtypeId: 'stadium', nature: '既有', owner: '浙江省黄龙体育中心', contact: '0571-88000006', status: 'pending', locked: true, createdBy: '王敏' },
    { id: 'p7', orgId: 'org-hz', campaignId: 'c1', kind: 'road', name: '文三路人行道（古荡段）', address: '文三路（古翠路—丰潭路段）北侧', lat: 30.2790, lng: 120.1080, lat2: 30.2796, lng2: 120.1150, subtypeId: 'road', nature: '既有', owner: '西湖区城管局', contact: '0571-88000007', status: 'pending', locked: true, createdBy: '王敏' },
    { id: 'p11', orgId: 'org-hz', campaignId: 'c1', kind: 'road', name: '曙光路盲道（黄龙段）', address: '曙光路（黄龙路口—浙图路口）东侧', lat: 30.2598, lng: 120.1295, lat2: 30.2642, lng2: 120.1355, subtypeId: 'road', nature: '既有', owner: '西湖区城管局', contact: '0571-88000009', status: 'pending', locked: true, createdBy: '王敏' },
    { id: 'p8', orgId: 'org-hz', campaignId: 'c1', kind: 'building', name: '西溪湿地周家村出入口广场', address: '西湖区天目山路518号', lat: 30.2660, lng: 120.0680, subtypeId: 'square', nature: '既有', owner: '西溪湿地管委会', contact: '0571-88000008', status: 'pending', locked: true, createdBy: '王敏' },
    { id: 'p9', orgId: 'org-cd', campaignId: 'c3', kind: 'building', name: '锦江区政务服务中心', address: '锦江区金石路166号', lat: 30.5980, lng: 104.0950, subtypeId: 'gov', nature: '既有', owner: '锦江区行政审批局', contact: '028-86000001', status: 'pending', locked: true, createdBy: '陈芳' },
    { id: 'p10', orgId: 'org-cd', campaignId: 'c3', kind: 'building', name: '四川大学华西第二医院锦江院区', address: '锦江区成龙大道一段1416号', lat: 30.5900, lng: 104.1100, subtypeId: 'hospital', nature: '新建', owner: '华西第二医院', contact: '028-86000002', status: 'pending', locked: true, createdBy: '陈芳' },
    { id: 'p12', orgId: 'org-cd', campaignId: 'c3', kind: 'road', name: '成龙大道人行道（华西段）', address: '成龙大道一段北侧', lat: 30.5915, lng: 104.1060, lat2: 30.5935, lng2: 104.1130, subtypeId: 'road', nature: '既有', owner: '锦江区住建交局', contact: '028-86000003', status: 'pending', locked: true, createdBy: '陈芳' },
  ],
  tasks: [
    { id: 't1', orgId: 'org-hz', pointId: 'p1', title: '政务服务中心无障碍复查督导', deadline: '2026-08-25', mode: 'assign', assigneeId: 'u-hz-insp', status: 'doing' },
    { id: 't2', orgId: 'org-hz', pointId: 'p2', title: '图书馆无障碍设施督导', deadline: '2026-08-30', mode: 'pool', status: 'pool' },
    { id: 't3', orgId: 'org-hz', pointId: 'p4', title: '地铁站无障碍专项督导', deadline: '2026-08-28', mode: 'pool', status: 'pool' },
    { id: 't4', orgId: 'org-hz', pointId: 'p7', title: '文三路人行道专项督导', deadline: '2026-09-05', mode: 'pool', status: 'pool' },
    { id: 't5', orgId: 'org-hz', pointId: 'p5', title: '旅馆建筑无障碍督导', deadline: '2026-08-10', mode: 'assign', assigneeId: 'u-hz-insp', status: 'done' },
    { id: 't6', orgId: 'org-hz', pointId: 'p6', title: '体育场馆无障碍专项督导', deadline: '2026-09-02', mode: 'pool', status: 'pool' },
    { id: 't7', orgId: 'org-cd', pointId: 'p9', title: '政务大厅无障碍督导', deadline: '2026-08-29', mode: 'pool', status: 'pool' },
  ],
  issues: [
    { id: 'i1', orgId: 'org-hz', pointId: 'p1', facility: 'parking', title: '无障碍停车位宽度不足', requirement: '无障碍停车位宽≥3.50m、长≥6.00m，一侧设≥1.20m轮椅通道', clause: 'G19 §2.9.2, §2.9.5', severity: 'M', desc: '实测宽度3.10m，未达标；地面标识磨损不清。', status: 'fixing', history: [{ at: '2026-08-10 09:20', action: '现场检查发现，自动生成问题单', by: '李强' }, { at: '2026-08-10 14:00', action: '组织管理员审核立案', by: '王敏' }, { at: '2026-08-11 10:00', action: '派单至责任单位，限期2026-08-24前整改', by: '王敏' }] },
    { id: 'i2', orgId: 'org-hz', pointId: 'p1', facility: 'lowdesk', title: '服务大厅低位服务台被占用', requirement: '对外服务窗口应设低位服务台，台面高0.70–0.75m，下部净空≥0.65m', clause: 'G63 §8.1.3', severity: 'M', desc: '低位服务台堆放宣传资料，膝部空间被遮挡。', status: 'recheck', history: [{ at: '2026-08-10 09:35', action: '现场检查发现，自动生成问题单', by: '李强' }, { at: '2026-08-10 14:00', action: '审核立案并派单', by: '王敏' }, { at: '2026-08-14 16:20', action: '责任单位反馈已整改，上传照片', by: '政务中心物业' }] },
    { id: 'i3', orgId: 'org-hz', pointId: 'p5', facility: 'toilet', title: '无障碍厕所紧急呼叫按钮缺失', requirement: '距坐便器0.40–0.50m处设紧急呼叫按钮', clause: 'G19 §3.1.4', severity: 'M', desc: '首层无障碍厕所未设紧急呼叫按钮。', status: 'closed', history: [{ at: '2026-08-05 10:00', action: '现场检查发现', by: '李强' }, { at: '2026-08-05 15:00', action: '立案派单', by: '王敏' }, { at: '2026-08-08 11:00', action: '整改反馈', by: '黄龙饭店工程部' }, { at: '2026-08-09 09:40', action: '复查通过，闭环销号', by: '李强' }] },
  ],
  inspections: [],
  currentOrgId: 'org-hz',
  currentUserId: 'u-hz-insp',
  activeTaskId: null,
}

/** ===== Store ===== */
type Action =
  | { type: 'SWITCH_ORG'; orgId: string }
  | { type: 'SWITCH_USER'; userId: string }
  | { type: 'ADD_CAMPAIGN'; campaign: Campaign }
  | { type: 'SET_CAMPAIGN_STATUS'; campaignId: string; status: Campaign['status'] }
  | { type: 'ADD_POINT'; point: Point }
  | { type: 'SET_POINT_STATUS'; pointId: string; status: PointStatus }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'CLAIM_TASK'; taskId: string; userId: string }
  | { type: 'SET_TASK_STATUS'; taskId: string; status: TaskStatus }
  | { type: 'START_TASK'; taskId: string }
  | { type: 'SUBMIT_INSPECTION'; inspection: Inspection; newIssues: Issue[]; pointStatus: PointStatus }
  | { type: 'ADVANCE_ISSUE'; issueId: string; action: string; by: string; to: IssueStatus }
  | { type: 'RESET' }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'SWITCH_ORG': {
      const firstUser = s.users.find(u => u.orgId === a.orgId && u.role === 'inspector') ?? s.users.find(u => u.orgId === a.orgId)!
      return { ...s, currentOrgId: a.orgId, currentUserId: firstUser.id, activeTaskId: null }
    }
    case 'SWITCH_USER': return { ...s, currentUserId: a.userId }
    case 'ADD_CAMPAIGN': return { ...s, campaigns: [...s.campaigns, a.campaign] }
    case 'SET_CAMPAIGN_STATUS': return { ...s, campaigns: s.campaigns.map(c => c.id === a.campaignId ? { ...c, status: a.status } : c) }
    case 'ADD_POINT': return { ...s, points: [...s.points, a.point] }
    case 'SET_POINT_STATUS': return { ...s, points: s.points.map(p => p.id === a.pointId ? { ...p, status: a.status } : p) }
    case 'ADD_TASK': return { ...s, tasks: [...s.tasks, a.task] }
    case 'CLAIM_TASK': return { ...s, tasks: s.tasks.map(t => t.id === a.taskId ? { ...t, status: 'todo', assigneeId: a.userId } : t) }
    case 'SET_TASK_STATUS': return { ...s, tasks: s.tasks.map(t => t.id === a.taskId ? { ...t, status: a.status } : t) }
    case 'START_TASK': return { ...s, activeTaskId: a.taskId, tasks: s.tasks.map(t => t.id === a.taskId ? { ...t, status: 'doing' } : t), points: s.points.map(p => p.id === s.tasks.find(t => t.id === a.taskId)?.pointId ? { ...p, status: 'inspecting' } : p) }
    case 'SUBMIT_INSPECTION': return {
      ...s,
      inspections: [...s.inspections, a.inspection],
      issues: [...s.issues, ...a.newIssues],
      points: s.points.map(p => p.id === a.inspection.pointId ? { ...p, status: a.pointStatus } : p),
      tasks: s.tasks.map(t => t.id === a.inspection.taskId ? { ...t, status: a.pointStatus === 'blocked' ? 'blocked' : 'done' } : t),
      activeTaskId: null,
    }
    case 'ADVANCE_ISSUE': {
      const issues = s.issues.map(i => i.id === a.issueId ? { ...i, status: a.to, history: [...i.history, { at: new Date().toLocaleString('zh-CN', { hour12: false }), action: a.action, by: a.by }] } : i)
      // 问题闭环以建筑/道路为单位：该对象全部问题闭环 → 对象状态转"已闭环"
      const target = issues.find(i => i.id === a.issueId)
      let points = s.points
      if (target && a.to === 'closed') {
        const rest = issues.filter(i => i.pointId === target.pointId && i.status !== 'closed')
        if (rest.length === 0) points = s.points.map(p => p.id === target.pointId ? { ...p, status: 'closed' } : p)
      } else if (target && a.to === 'recheck') {
        points = s.points.map(p => p.id === target.pointId ? { ...p, status: 'recheck' } : p)
      }
      return { ...s, issues, points }
    }
    case 'RESET': return seed
    default: return s
  }
}

const StoreCtx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null)
const LS_KEY = 'wza-dudao-proto-v3'

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, seed, () => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? { ...seed, ...JSON.parse(raw), activeTaskId: null } : seed
    } catch { return seed }
  })
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(state)) }, [state])
  const v = useMemo(() => ({ state, dispatch }), [state])
  return <StoreCtx.Provider value={v}>{children}</StoreCtx.Provider>
}

export function useStore() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('store missing')
  return ctx
}

export function useCurrent() {
  const { state } = useStore()
  const org = state.orgs.find(o => o.id === state.currentOrgId)!
  const user = state.users.find(u => u.id === state.currentUserId)!
  return { org, user }
}

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`

export function inRegion(org: Org, lat: number, lng: number) {
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
