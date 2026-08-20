import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { useCampaigns, useClaimTask, usePoints, useReturnTask, useStartTask, useTasks } from '@/api/hooks'
import { useAuth } from '@/auth/AuthContext'
import type { Task } from '@/api/types'
import { SUBTYPE_MAP } from '@/data/checklib'
import { Pager, usePager } from '@/components/Pager'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, Hand, History, MapPin, Play, Route, Undo2 } from 'lucide-react'

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pool: { label: '待领取', cls: 'bg-sky-100 text-sky-700' },
  todo: { label: '待执行', cls: 'bg-amber-100 text-amber-700' },
  doing: { label: '督导中', cls: 'bg-blue-100 text-blue-700' },
  done: { label: '已完成', cls: 'bg-green-100 text-green-700' },
  blocked: { label: '无法督导结办', cls: 'bg-purple-100 text-purple-700' },
}

const TABS = [
  { id: 'mine', label: '我的任务' },
  { id: 'pool', label: '任务池' },
  { id: 'done', label: '已结办' },
] as const
type TabId = (typeof TABS)[number]['id']

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

/** 移动版督导任务：与 Web 端共用同一 API（/tasks claim/start/return、/inspections） */
export default function MobileTasks({ onStart, onViewReport }: { onStart: (taskId: string) => void; onViewReport: (taskId: string) => void }) {
  const { user } = useAuth()
  const { data: campaigns = [] } = useCampaigns()
  const { data: points = [] } = usePoints()
  const { data: tasks = [] } = useTasks()
  const claimTask = useClaimTask()
  const startTask = useStartTask()
  const returnTask = useReturnTask()

  const [tab, setTab] = useState<TabId>('mine')

  const pool = tasks.filter(t => t.status === 'pool')
  const mine = tasks.filter(t => t.assigneeId === user?.id && (t.status === 'todo' || t.status === 'doing'))
  const done = tasks.filter(t => t.status === 'done' || t.status === 'blocked')
  const counts: Record<TabId, number> = { pool: pool.length, mine: mine.length, done: done.length }
  const list = tab === 'pool' ? pool : tab === 'mine' ? mine : done
  const pg = usePager(list, 6, tab)

  /** 组织管理员：退回已结办任务为编辑状态 */
  const doReturn = async (t: Task) => {
    if (!confirm(`将「${t.title}」退回编辑状态？督导员可重新进入补充核查并再次提交。`)) return
    try {
      await returnTask.mutateAsync(t.id)
      toast.success('已退回编辑状态')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '退回失败')
    }
  }

  const pointOf = (id: string) => points.find(p => p.id === id)
  const campaignOf = (id?: string) => campaigns.find(c => c.id === id)

  const claim = async (t: Task) => {
    try {
      await claimTask.mutateAsync(t.id)
      toast.success('已领取任务，可在"我的任务"中开始督导')
      setTab('mine')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '领取失败')
    }
  }

  const start = async (t: Task) => {
    if (t.status === 'doing') { onStart(t.id); return }
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

  return (
    <div className="p-3 space-y-3">
      {/* 分段选项卡 */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/70 rounded-lg p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${tab === t.id ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-500'}`}>
            {t.label}（{counts[t.id]}）
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {pg.pageItems.map(t => {
          const p = pointOf(t.pointId)
          const st = SUBTYPE_MAP[p?.subtypeId ?? '']
          const ts = TASK_STATUS[t.status]
          const finished = t.status === 'done' || t.status === 'blocked'
          return (
            <Card key={t.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {p?.kind === 'road' ? <Route className="w-4 h-4 text-sky-600 shrink-0" /> : <Building2 className="w-4 h-4 text-teal-700 shrink-0" />}
                  <span className="font-medium text-sm flex-1 min-w-0 truncate">{t.title}</span>
                  <Badge variant="secondary" className={ts.cls + ' text-[11px] shrink-0'}>{ts.label}</Badge>
                </div>
                <p className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
                  <MapPin className="w-3 h-3 shrink-0" />{p?.name}{st?.star ? ' ★' : ''} · {p?.kind === 'road' ? '道路线段' : st?.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {campaignOf(p?.campaignId)?.name ?? '—'} · 截止 {t.deadline}
                  {t.assigneeId && tab !== 'mine' ? ' · 已被领取' : ''}
                </p>
                {tab === 'pool' && (
                  <Button className="w-full h-9" variant="outline" disabled={claimTask.isPending} onClick={() => void claim(t)}>
                    <Hand className="w-4 h-4 mr-1" />领取任务
                  </Button>
                )}
                {tab === 'mine' && (
                  <Button className="w-full h-9" disabled={startTask.isPending} onClick={() => void start(t)}>
                    <Play className="w-4 h-4 mr-1" />{t.status === 'doing' ? '继续督导' : 'GPS 签到并开始督导'}
                  </Button>
                )}
                <div className="flex gap-2">
                  {/* 任务日志 / 督导报告：任何状态都可进入查看（已结办可再次查看报告） */}
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-slate-500 flex-1" onClick={() => onViewReport(t.id)}>
                    <History className="w-3.5 h-3.5 mr-1" />{finished ? '查看督导报告' : '任务日志'}
                  </Button>
                  {finished && user?.role === 'admin' && (
                    <Button variant="outline" size="sm" className="h-8 text-xs flex-1" disabled={returnTask.isPending} onClick={() => void doReturn(t)}>
                      <Undo2 className="w-3.5 h-3.5 mr-1" />退回补充
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {list.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            {tab === 'pool' ? '暂无待领取任务' : tab === 'mine' ? '暂无进行中的任务，可先到任务池领取' : '暂无已结办任务'}
          </p>
        )}
        <Pager page={pg.page} totalPages={pg.totalPages} total={pg.total} onChange={pg.setPage} />
      </div>
    </div>
  )
}
