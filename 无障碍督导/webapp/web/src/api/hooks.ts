import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost } from './client'
import type { ChecklibPayload } from '@/data/checklib'
import type {
  Campaign,
  CheckProfile,
  Inspection,
  Issue,
  IssueStatus,
  LoginResponse,
  MainInfo,
  MeResponse,
  InstanceResult,
  Org,
  Point,
  PointStatus,
  Role,
  StatsOverview,
  Task,
  TaskDetail,
  User,
} from './types'

/** ===== Query Keys ===== */
export const QK = {
  me: ['me'] as const,
  orgs: ['orgs'] as const,
  users: ['users'] as const,
  campaigns: ['campaigns'] as const,
  points: ['points'] as const,
  tasks: ['tasks'] as const,
  issues: ['issues'] as const,
  inspections: ['inspections'] as const,
  stats: ['stats'] as const,
}

/** ===== Queries ===== */
export const useMe = (enabled = true) =>
  useQuery({ queryKey: QK.me, queryFn: () => apiGet<MeResponse>('/auth/me'), enabled, retry: false, staleTime: 60_000 })

export const useOrgs = () =>
  useQuery({ queryKey: QK.orgs, queryFn: () => apiGet<Org[]>('/orgs') })

export const useUsers = (orgId?: string) =>
  useQuery({ queryKey: [...QK.users, orgId ?? ''], queryFn: () => apiGet<User[]>(`/users${orgId ? `?orgId=${orgId}` : ''}`) })

export const useCampaigns = () =>
  useQuery({ queryKey: QK.campaigns, queryFn: () => apiGet<Campaign[]>('/campaigns') })

/** 检查项配置版本列表（不含 payload） */
export const useCheckProfiles = () =>
  useQuery({ queryKey: ['checkProfiles'] as const, queryFn: () => apiGet<CheckProfile[]>('/check-profiles') })

/** 检查项配置详情（含完整 payload） */
export const useCheckProfile = (id: string | null | undefined) =>
  useQuery({
    queryKey: ['checkProfiles', id ?? ''] as const,
    queryFn: () => apiGet<CheckProfile>(`/check-profiles/${id}`),
    enabled: !!id,
  })

/** 点位所属行动选用的检查项配置载荷（未加载完成时返回 undefined → 前端回退内置库） */
export const usePointLib = (point?: { campaignId?: string | null }) => {
  const { data: campaigns = [] } = useCampaigns()
  const profileId = campaigns.find(c => c.id === point?.campaignId)?.profileId ?? 'prof-quick'
  const { data: profile } = useCheckProfile(profileId)
  return profile?.payload as ChecklibPayload | undefined
}

export const usePoints = (campaignId?: string) =>
  useQuery({ queryKey: [...QK.points, campaignId ?? ''], queryFn: () => apiGet<Point[]>(`/points${campaignId ? `?campaignId=${campaignId}` : ''}`) })

export const useTasks = () =>
  useQuery({ queryKey: QK.tasks, queryFn: () => apiGet<Task[]>('/tasks') })

export const useIssues = (filters?: { status?: IssueStatus; pointId?: string }) => {
  const qs = new URLSearchParams()
  if (filters?.status) qs.set('status', filters.status)
  if (filters?.pointId) qs.set('pointId', filters.pointId)
  const suffix = qs.size ? `?${qs}` : ''
  return useQuery({ queryKey: [...QK.issues, filters?.status ?? '', filters?.pointId ?? ''], queryFn: () => apiGet<Issue[]>(`/issues${suffix}`) })
}

export const useInspections = (pointId?: string) =>
  useQuery({
    queryKey: [...QK.inspections, pointId ?? ''],
    queryFn: () => apiGet<Inspection[]>(`/inspections${pointId ? `?pointId=${pointId}` : ''}`),
  })

export const useStats = (campaignId?: string) =>
  useQuery({
    queryKey: [...QK.stats, campaignId ?? ''],
    queryFn: () => apiGet<StatsOverview>(`/stats/overview${campaignId ? `?campaignId=${encodeURIComponent(campaignId)}` : ''}`),
  })

/** ===== Mutations ===== */
export const useLogin = () =>
  useMutation({ mutationFn: (body: { phone: string; password: string }) => apiPost<LoginResponse>('/auth/login', body) })

export const useCreateCampaign = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; regionDesc?: string; bounds?: [[number, number], [number, number]]; profileId?: string }) =>
      apiPost<Campaign>('/campaigns', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.campaigns }),
  })
}

export const useUpdateCampaign = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status: Campaign['status'] }) => apiPatch<Campaign>(`/campaigns/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.campaigns }),
  })
}

export const useCreatePoint = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<Point, 'id' | 'orgId' | 'status' | 'locked' | 'changeLog' | 'createdBy' | 'createdAt' | 'updatedAt'> & { reason?: string; publishTask?: boolean; taskTitle?: string; taskDeadline?: string }) =>
      apiPost<Point & { publishedTask?: Task | null }>('/points', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.points })
      qc.invalidateQueries({ queryKey: QK.tasks })
      qc.invalidateQueries({ queryKey: QK.stats })
    },
  })
}

export const useUpdatePoint = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Pick<Point, 'name' | 'address' | 'lat' | 'lng' | 'lat2' | 'lng2' | 'subtypeId' | 'nature' | 'owner' | 'contact' | 'status'>> & { reason?: string }) =>
      apiPatch<Point>(`/points/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.points })
      qc.invalidateQueries({ queryKey: QK.stats })
    },
  })
}

const invalidateTaskRelated = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: QK.tasks })
  qc.invalidateQueries({ queryKey: QK.points })
}

export const useCreateTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { pointId: string; title: string; deadline: string; mode: 'pool' | 'assign'; assigneeId?: string }) =>
      apiPost<Task>('/tasks', body),
    onSuccess: () => invalidateTaskRelated(qc),
  })
}

export const useClaimTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPost<Task>(`/tasks/${id}/claim`),
    onSuccess: () => invalidateTaskRelated(qc),
  })
}

export const useStartTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; lat?: number; lng?: number; force?: boolean }) =>
      apiPost<Task>(`/tasks/${id}/start`, body),
    onSuccess: () => invalidateTaskRelated(qc),
  })
}

export const useReleaseTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPost<Task>(`/tasks/${id}/release`),
    onSuccess: () => invalidateTaskRelated(qc),
  })
}

/** 任务详情（含日志/检查记录/问题单），用于督导报告 */
export const useTaskDetail = (id: string | null) =>
  useQuery({
    queryKey: [...QK.tasks, 'detail', id],
    queryFn: () => apiGet<TaskDetail>(`/tasks/${id}`),
    enabled: id != null,
  })

/** 组织管理员：已结办任务退回编辑状态 */
export const useReturnTask = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiPost<Task>(`/tasks/${id}/return`),
    onSuccess: () => invalidateTaskRelated(qc),
  })
}

export const useSubmitInspection = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { taskId: string; mainInfo: MainInfo; instances: InstanceResult[]; condTriggered?: string[] }) =>
      apiPost<{ inspection: Inspection; issues: Issue[] }>('/inspections', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.tasks })
      qc.invalidateQueries({ queryKey: QK.points })
      qc.invalidateQueries({ queryKey: QK.issues })
      qc.invalidateQueries({ queryKey: QK.inspections })
      qc.invalidateQueries({ queryKey: QK.stats })
    },
  })
}

export const useCreateIssue = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { pointId: string; facility: string; title: string; requirement: string; clause: string; severity: 'M' | 'C' | 'R'; desc: string; photos?: string[] }) =>
      apiPost<Issue>('/issues', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.issues })
      qc.invalidateQueries({ queryKey: QK.points })
      qc.invalidateQueries({ queryKey: QK.stats })
    },
  })
}

export const useAdvanceIssue = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; to?: string; action?: string; note?: string; photos?: string[]; responsible?: string; deadline?: string }) =>
      apiPost<Issue>(`/issues/${id}/advance`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.issues })
      qc.invalidateQueries({ queryKey: QK.points })
      qc.invalidateQueries({ queryKey: QK.stats })
    },
  })
}

export const useCreateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; phone: string; role: Extract<Role, 'admin' | 'inspector'>; password?: string; orgId?: string }) =>
      apiPost<User>('/users', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  })
}

/** 用户自助：修改本人姓名/手机号/密码 */
export const useSelfPatch = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name?: string; phone?: string; oldPassword?: string; newPassword?: string }) =>
      apiPatch<User>('/users/me', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.me })
      qc.invalidateQueries({ queryKey: QK.users })
    },
  })
}

export const useUpdateUser = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Pick<User, 'name' | 'role' | 'status' | 'certNo' | 'certExpiresAt'>> & { password?: string }) =>
      apiPatch<User>(`/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  })
}

export const useCreateOrg = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; orgType: string; regionName: string; center: [number, number]; bounds: [[number, number], [number, number]]; expiresAt?: string; adminName?: string; adminPhone?: string; adminPassword?: string }) =>
      apiPost<{ org: Org; adminUser: User | null }>('/orgs', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.orgs }),
  })
}

export const useUpdateOrg = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<Pick<Org, 'name' | 'orgType' | 'regionName' | 'center' | 'bounds' | 'status' | 'expiresAt'>>) =>
      apiPatch<Org>(`/orgs/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.orgs }),
  })
}

export const useReseed = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>('/admin/reseed'),
    onSuccess: () => qc.invalidateQueries(),
  })
}

/** 供页面直接复用的类型 re-export */
export type { PointStatus }
