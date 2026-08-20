import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useCampaigns, useClaimTask, useCreateTask, usePoints, useReturnTask, useStartTask, useTasks, useUsers } from '@/api/hooks'
import { useAuth } from '@/auth/AuthContext'
import type { Task } from '@/api/types'
import { SUBTYPE_MAP } from '@/data/checklib'
import { Pager, usePager } from '@/components/Pager'
import TaskReport from '@/components/TaskReport'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, ClipboardList, Hand, History, MapPin, Play, Plus, Route, Undo2 } from 'lucide-react'

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pool: { label: '待领取', cls: 'bg-sky-100 text-sky-700' },
  todo: { label: '待执行', cls: 'bg-amber-100 text-amber-700' },
  doing: { label: '督导中', cls: 'bg-blue-100 text-blue-700' },
  done: { label: '已完成', cls: 'bg-green-100 text-green-700' },
  blocked: { label: '无法督导结办', cls: 'bg-purple-100 text-purple-700' },
}

const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

function getPosition(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(undefined)
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(undefined),
      { timeout: 5000, maximumAge: 30_000 },
    )
  })
}

export default function TasksPage({ onStart }: { onStart: (taskId: string) => void }) {
  const { user } = useAuth()
  const { data: campaigns = [] } = useCampaigns()
  const { data: points = [] } = usePoints()
  const { data: tasks = [] } = useTasks()
  const { data: users = [] } = useUsers()
  const createTask = useCreateTask()
  const claimTask = useClaimTask()
  const startTask = useStartTask()
  const returnTask = useReturnTask()
  /** 查看中的督导报告（任务日志 + 检查记录） */
  const [reportId, setReportId] = useState<string | null>(null)

  const activeCampaigns = campaigns.filter(c => c.status === 'active')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ campaignId: '', pointId: '', deadline: '2026-09-15', mode: 'pool' as 'pool' | 'assign' })

  const pool = tasks.filter(t => t.status === 'pool')
  const mine = tasks.filter(t => t.assigneeId === user?.id && (t.status === 'todo' || t.status === 'doing'))
  const done = tasks.filter(t => t.status === 'done' || t.status === 'blocked')
  const poolPg = usePager(pool, 5)
  const minePg = usePager(mine, 5)
  const donePg = usePager(done, 8)

  const candidatePoints = points.filter(p => p.campaignId === form.campaignId && !tasks.some(t => t.pointId === p.id && (t.status === 'pool' || t.status === 'todo' || t.status === 'doing')))

  const pointOf = (id: string) => points.find(p => p.id === id)
  const campaignOf = (id?: string) => campaigns.find(c => c.id === id)

  const create = async () => {
    const p = pointOf(form.pointId)
    if (!p || !user) return
    try {
      await createTask.mutateAsync({
        pointId: p.id,
        title: `${p.name}无障碍督导`,
        deadline: form.deadline,
        mode: form.mode,
        assigneeId: form.mode === 'assign' ? user.id : undefined,
      })
      toast.success('任务已创建')
      setCreating(false)
      setForm({ ...form, pointId: '', campaignId: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建任务失败')
    }
  }

  const claim = async (t: Task) => {
    try {
      await claimTask.mutateAsync(t.id)
      toast.success('已领取任务')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '领取失败')
    }
  }

  const start = async (t: Task) => {
    if (t.status === 'doing') { onStart(t.id); return }   // 继续督导：无需重复签到
    const coords = await getPosition()
    try {
      await startTask.mutateAsync({ id: t.id, ...coords })
      onStart(t.id)
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.message.includes('超出签到允许范围')) {
        if (confirm(`${e.message}\n是否仍要强制签到？`)) {
          try {
            await startTask.mutateAsync({ id: t.id, ...coords, force: true })
            onStart(t.id)
          } catch (e2) {
            toast.error(e2 instanceof Error ? e2.message : '开始督导失败')
          }
        }
      } else {
        toast.error(e instanceof Error ? e.message : '开始督导失败')
      }
    }
  }

  /** 组织管理员：退回已结办任务为编辑状态（督导员可重新进入补充核查） */
  const doReturn = async (t: Task) => {
    if (!confirm(`将「${t.title}」退回编辑状态？督导员可重新进入补充核查并再次提交。`)) return
    try {
      await returnTask.mutateAsync(t.id)
      toast.success('已退回编辑状态，任务回到"我的任务"')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '退回失败')
    }
  }

  if (reportId) return <TaskReport taskId={reportId} onBack={() => setReportId(null)} />

  const Row = ({ t, action }: { t: Task; action?: React.ReactNode }) => {
    const p = pointOf(t.pointId)
    const st = SUBTYPE_MAP[p?.subtypeId ?? '']
    const ts = TASK_STATUS[t.status]
    const finished = t.status === 'done' || t.status === 'blocked'
    return (
      <Card>
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {p?.kind === 'road' ? <Route className="w-4 h-4 text-sky-600 shrink-0" /> : <Building2 className="w-4 h-4 text-teal-700 shrink-0" />}
              <span className="font-medium text-sm truncate">{t.title}</span>
              <Badge variant="secondary" className={ts.cls + ' text-[11px]'}>{ts.label}</Badge>
              {t.mode === 'pool' && <Badge variant="outline" className="text-[11px]">任务池</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 flex-wrap">
              <MapPin className="w-3 h-3" /> {p?.name}{st?.star ? ' ★' : ''} · {p?.kind === 'road' ? '道路线段' : st?.name} · 所属行动：{campaignOf(p?.campaignId)?.name ?? '—'} · 截止 {t.deadline}
              {t.assigneeId && ` · 执行人：${users.find(u => u.id === t.assigneeId)?.name ?? ''}`}
            </p>
          </div>
          {/* 任务日志 / 督导报告：任何状态都可进入查看 */}
          <Button size="sm" variant="ghost" className="text-slate-500 shrink-0" onClick={() => setReportId(t.id)}>
            <History className="w-4 h-4 mr-1" />{finished ? '督导报告' : '日志'}
          </Button>
          {finished && user?.role === 'admin' && (
            <Button size="sm" variant="outline" className="shrink-0" disabled={returnTask.isPending} onClick={() => void doReturn(t)}>
              <Undo2 className="w-4 h-4 mr-1" />退回补充
            </Button>
          )}
          {action}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="w-5 h-5 text-teal-700" /> 督导任务</h2>
          {user?.role === 'admin' && (
            <Button size="sm" variant={creating ? 'secondary' : 'default'} onClick={() => setCreating(!creating)}>
              <Plus className="w-4 h-4 mr-1" />{creating ? '取消' : '创建任务'}
            </Button>
          )}
        </div>

        {creating && user?.role === 'admin' && (
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="py-4 px-4 space-y-2 text-sm">
              <p className="font-medium text-teal-800">先选行动，再选行动内的督导对象（建筑/道路，位置与类别已锁定）</p>
              <div className="flex gap-2 flex-wrap">
                <select className={selCls + ' min-w-[200px]'} value={form.campaignId} onChange={e => setForm({ ...form, campaignId: e.target.value, pointId: '' })}>
                  <option value="">选择行动…</option>
                  {activeCampaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select className={selCls + ' flex-1 min-w-[220px]'} value={form.pointId} onChange={e => setForm({ ...form, pointId: e.target.value })} disabled={!form.campaignId}>
                  <option value="">选择督导对象…</option>
                  {candidatePoints.map(p => <option key={p.id} value={p.id}>{p.kind === 'road' ? '🛣' : '🏢'} {p.name}（{SUBTYPE_MAP[p.subtypeId]?.name}）</option>)}
                </select>
                <input className={selCls} type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
                <select className={selCls} value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value as 'pool' | 'assign' })}>
                  <option value="pool">放入任务池（督导员领取）</option>
                  <option value="assign">直接指派给我</option>
                </select>
              </div>
              <Button size="sm" disabled={!form.pointId || createTask.isPending} onClick={() => void create()}>创建任务</Button>
            </CardContent>
          </Card>
        )}

        <section>
          <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1"><Hand className="w-4 h-4" /> 任务池（可领取）· {pool.length}</h3>
          <div className="space-y-2">
            {poolPg.pageItems.map(t => (
              <Row key={t.id} t={t} action={
                <Button size="sm" variant="outline" disabled={claimTask.isPending} onClick={() => void claim(t)}>领取任务</Button>
              } />
            ))}
            {pool.length === 0 && <p className="text-sm text-slate-400">暂无待领取任务</p>}
            <Pager page={poolPg.page} totalPages={poolPg.totalPages} total={poolPg.total} onChange={poolPg.setPage} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-600 mb-2">我的任务 · {mine.length}</h3>
          <div className="space-y-2">
            {minePg.pageItems.map(t => (
              <Row key={t.id} t={t} action={
                <Button size="sm" disabled={startTask.isPending} onClick={() => void start(t)}>
                  <Play className="w-4 h-4 mr-1" />{t.status === 'doing' ? '继续督导' : '开始督导'}
                </Button>
              } />
            ))}
            {mine.length === 0 && <p className="text-sm text-slate-400">暂无进行中的任务，可先从任务池领取</p>}
            <Pager page={minePg.page} totalPages={minePg.totalPages} total={minePg.total} onChange={minePg.setPage} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-600 mb-2">已结办 · {done.length}</h3>
          <div className="space-y-2">
            {donePg.pageItems.map(t => <Row key={t.id} t={t} />)}
            {done.length === 0 && <p className="text-sm text-slate-400">暂无</p>}
            <Pager page={donePg.page} totalPages={donePg.totalPages} total={donePg.total} onChange={donePg.setPage} />
          </div>
        </section>
      </div>
    </div>
  )
}
