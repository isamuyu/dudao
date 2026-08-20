import { useMemo, useState } from 'react'
import { useStore, useCurrent, uid } from '@/store/app'
import { SUBTYPE_MAP } from '@/data/checklib'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, ClipboardList, Hand, Play, MapPin, Plus, Route } from 'lucide-react'

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pool: { label: '待领取', cls: 'bg-sky-100 text-sky-700' },
  todo: { label: '待执行', cls: 'bg-amber-100 text-amber-700' },
  doing: { label: '督导中', cls: 'bg-blue-100 text-blue-700' },
  done: { label: '已完成', cls: 'bg-green-100 text-green-700' },
  blocked: { label: '无法采集结办', cls: 'bg-purple-100 text-purple-700' },
}

const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

export default function TasksPage() {
  const { state, dispatch } = useStore()
  const { org, user } = useCurrent()
  const campaigns = state.campaigns.filter(c => c.orgId === org.id && c.status === 'active')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ campaignId: '', pointId: '', deadline: '2026-09-15', mode: 'pool' as 'pool' | 'assign' })

  const orgTasks = state.tasks.filter(t => t.orgId === org.id)
  const pool = orgTasks.filter(t => t.status === 'pool')
  const mine = orgTasks.filter(t => t.assigneeId === user.id && (t.status === 'todo' || t.status === 'doing'))
  const done = orgTasks.filter(t => t.status === 'done' || t.status === 'blocked')

  const candidatePoints = useMemo(
    () => state.points.filter(p => p.orgId === org.id && p.campaignId === form.campaignId && !orgTasks.some(t => t.pointId === p.id && (t.status === 'pool' || t.status === 'todo' || t.status === 'doing'))),
    [state.points, org.id, orgTasks, form.campaignId],
  )

  const pointOf = (id: string) => state.points.find(p => p.id === id)
  const campaignOf = (id?: string) => state.campaigns.find(c => c.id === id)

  const Row = ({ t, action }: { t: typeof orgTasks[number]; action?: React.ReactNode }) => {
    const p = pointOf(t.pointId)
    const st = SUBTYPE_MAP[p?.subtypeId ?? '']
    const ts = TASK_STATUS[t.status]
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
              {t.assigneeId && ` · 执行人：${state.users.find(u => u.id === t.assigneeId)?.name ?? ''}`}
            </p>
          </div>
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
          {user.role === 'admin' && (
            <Button size="sm" variant={creating ? 'secondary' : 'default'} onClick={() => setCreating(!creating)}>
              <Plus className="w-4 h-4 mr-1" />{creating ? '取消' : '创建任务'}
            </Button>
          )}
        </div>

        {creating && user.role === 'admin' && (
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="py-4 px-4 space-y-2 text-sm">
              <p className="font-medium text-teal-800">先选行动，再选行动内的督导对象（建筑/道路，位置与类别已锁定）</p>
              <div className="flex gap-2 flex-wrap">
                <select className={selCls + ' min-w-[200px]'} value={form.campaignId} onChange={e => setForm({ ...form, campaignId: e.target.value, pointId: '' })}>
                  <option value="">选择行动…</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
              <Button size="sm" disabled={!form.pointId} onClick={() => {
                const p = pointOf(form.pointId)!
                dispatch({ type: 'ADD_TASK', task: { id: uid('t'), orgId: org.id, pointId: p.id, title: `${p.name}无障碍督导`, deadline: form.deadline, mode: form.mode, status: form.mode === 'pool' ? 'pool' : 'todo', assigneeId: form.mode === 'assign' ? user.id : undefined } })
                setCreating(false); setForm({ ...form, pointId: '', campaignId: '' })
              }}>创建任务</Button>
            </CardContent>
          </Card>
        )}

        <section>
          <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-1"><Hand className="w-4 h-4" /> 任务池（可领取）· {pool.length}</h3>
          <div className="space-y-2">
            {pool.map(t => (
              <Row key={t.id} t={t} action={
                <Button size="sm" variant="outline" onClick={() => dispatch({ type: 'CLAIM_TASK', taskId: t.id, userId: user.id })}>领取任务</Button>
              } />
            ))}
            {pool.length === 0 && <p className="text-sm text-slate-400">暂无待领取任务</p>}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-600 mb-2">我的任务 · {mine.length}</h3>
          <div className="space-y-2">
            {mine.map(t => (
              <Row key={t.id} t={t} action={
                <Button size="sm" onClick={() => dispatch({ type: 'START_TASK', taskId: t.id })}>
                  <Play className="w-4 h-4 mr-1" />{t.status === 'doing' ? '继续督导' : '开始督导'}
                </Button>
              } />
            ))}
            {mine.length === 0 && <p className="text-sm text-slate-400">暂无进行中的任务，可先从任务池领取</p>}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-slate-600 mb-2">已结办 · {done.length}</h3>
          <div className="space-y-2">
            {done.map(t => <Row key={t.id} t={t} />)}
            {done.length === 0 && <p className="text-sm text-slate-400">暂无</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
