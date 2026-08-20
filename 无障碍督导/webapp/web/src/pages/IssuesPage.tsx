import { useState } from 'react'
import { toast } from 'sonner'
import { ISSUE_STATUS_META, POINT_STATUS_META, type Issue, type IssueStatus, type Role } from '@/store/app'
import { useAdvanceIssue, useIssues, usePoints } from '@/api/hooks'
import { useAuth } from '@/auth/AuthContext'
import { facilityName, SUBTYPE_MAP } from '@/data/checklib'
import PhotoPicker from '@/components/PhotoPicker'
import { Pager, usePager } from '@/components/Pager'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronDown, ChevronRight, MinusCircle, Route } from 'lucide-react'

const SEV: Record<string, { label: string; cls: string }> = {
  M: { label: '违反强制性条文', cls: 'bg-red-100 text-red-700' },
  C: { label: '一般问题', cls: 'bg-amber-100 text-amber-700' },
  R: { label: '建议改进', cls: 'bg-sky-100 text-sky-700' },
}

interface Transition {
  to: IssueStatus
  action: string
  roles: Role[]
  /** 立案派单时可填责任单位/期限 */
  assign?: boolean
  /** 暂不立案时必须填写补充说明 */
  needNote?: boolean
}

/** 问题单状态机（契约 §3 issues/advance） */
const FLOW: Partial<Record<IssueStatus, Transition[]>> = {
  open: [
    { to: 'assigned', action: '审核立案并派单', roles: ['admin'], assign: true },
    { to: 'deferred', action: '暂不立案', roles: ['admin'], needNote: true },
  ],
  deferred: [{ to: 'assigned', action: '审核立案并派单', roles: ['admin'], assign: true }],
  assigned: [{ to: 'fixing', action: '整改反馈', roles: ['admin', 'inspector'] }],
  fixing: [{ to: 'recheck', action: '整改完成，申请复查', roles: ['admin', 'inspector'] }],
  recheck: [
    { to: 'closed', action: '复查通过，闭环销号', roles: ['admin', 'inspector'] },
    { to: 'fixing', action: '复查不通过，退回整改', roles: ['admin', 'inspector'] },
  ],
}

export default function IssuesPage() {
  const { user } = useAuth()
  const { data: issues = [] } = useIssues()
  const { data: points = [] } = usePoints()
  const advanceIssue = useAdvanceIssue()

  const [dialog, setDialog] = useState<{ issue: Issue; trans: Transition } | null>(null)
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [responsible, setResponsible] = useState('')
  const [deadline, setDeadline] = useState('')
  /** 展开的问题单 id（默认全部折叠，点击标题行展开详情） */
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const toggleExpand = (id: string) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))

  // 以建筑/道路为单位分组管理
  const objects = points
    .filter(p => issues.some(i => i.pointId === p.id))
    .map(p => {
      const list = issues.filter(i => i.pointId === p.id)
      const active = (s: Issue['status']) => s !== 'closed' && s !== 'deferred'
      return { point: p, list, open: list.filter(i => active(i.status)).length, closed: list.filter(i => i.status === 'closed').length }
    })
  const objsPg = usePager(objects, 5)

  const openDialog = (issue: Issue, trans: Transition) => {
    setDialog({ issue, trans })
    setNote('')
    setPhotos([])
    setResponsible(issue.responsible ?? '')
    setDeadline(issue.deadline ?? '')
  }

  const confirmAdvance = async () => {
    if (!dialog) return
    if (dialog.trans.needNote && !note.trim()) {
      toast.error('暂不立案需填写补充说明')
      return
    }
    try {
      await advanceIssue.mutateAsync({
        id: dialog.issue.id,
        to: dialog.trans.to,
        note: note || undefined,
        photos: photos.length ? photos : undefined,
        responsible: dialog.trans.assign && responsible ? responsible : undefined,
        deadline: dialog.trans.assign && deadline ? deadline : undefined,
      })
      toast.success(`${dialog.trans.action} → ${ISSUE_STATUS_META[dialog.trans.to]}`)
      setDialog(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  const transitionsOf = (i: Issue) =>
    (FLOW[i.status] ?? []).filter(t => user && t.roles.includes(user.role))

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" /> 问题整改闭环
          <span className="text-xs font-normal text-slate-400">以建筑/道路为单位管理 · 督导发现的问题进入待闭环 → 立案 → 派单 → 整改 → 复查 → 闭环销号</span>
        </h2>

        <div className="space-y-4">
          {objsPg.pageItems.map(({ point, list, open, closed }) => {
            const sm = POINT_STATUS_META[point.status]
            return (
              <Card key={point.id}>
                <CardContent className="py-3 px-4 space-y-3">
                  {/* 对象头 */}
                  <div className="flex items-center gap-2 flex-wrap border-b pb-2">
                    {point.kind === 'road' ? <Route className="w-4 h-4 text-sky-600" /> : <Building2 className="w-4 h-4 text-teal-700" />}
                    <span className="font-semibold text-sm">{point.name}{SUBTYPE_MAP[point.subtypeId]?.star && <span className="text-amber-500"> ★</span>}</span>
                    <span className="text-xs text-slate-400">{point.kind === 'road' ? '道路线段' : SUBTYPE_MAP[point.subtypeId]?.name}</span>
                    <Badge style={{ backgroundColor: sm.color }} className="text-white text-[11px]">{sm.label}</Badge>
                    <span className="flex-1" />
                    <span className="text-xs text-red-600 font-medium">待闭环 {open}</span>
                    <span className="text-xs text-green-600">已闭环 {closed}</span>
                  </div>

                  {list.map(i => {
                    const trans = transitionsOf(i)
                    const expanded = !!expandedIds[i.id]
                    return (
                      <div key={i.id} className={`rounded-md border ${i.status === 'closed' ? 'bg-green-50/40 border-green-200' : i.status === 'deferred' ? 'bg-slate-50/60 border-slate-200' : 'bg-white'}`}>
                        {/* 标题行（默认折叠，点击展开详情） */}
                        <button type="button" className="w-full flex items-center gap-2 flex-wrap text-left p-3 cursor-pointer select-none" onClick={() => toggleExpand(i.id)}>
                          {expanded
                            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                          {i.status === 'closed'
                            ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            : i.status === 'deferred'
                              ? <MinusCircle className="w-4 h-4 text-slate-400 shrink-0" />
                              : <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                          <span className="font-medium text-sm">{i.title}</span>
                          <Badge variant="secondary" className={SEV[i.severity].cls + ' text-[11px]'}>{SEV[i.severity].label}</Badge>
                          <Badge variant="outline" className="text-[11px]">{ISSUE_STATUS_META[i.status]}</Badge>
                          <span className="flex-1" />
                          <span className="text-[11px] text-slate-400">{facilityName(i.facility)}{expanded ? ' · 点击收起' : ' · 点击展开'}</span>
                        </button>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-1.5 border-t pt-2">
                            <p className="text-xs text-slate-500">{facilityName(i.facility)} · 条款：{i.clause}
                              {i.responsible && <span> · 责任单位：{i.responsible}</span>}
                              {i.deadline && <span> · 整改期限：{i.deadline}</span>}
                            </p>
                            <p className="text-xs text-slate-600 bg-slate-50 rounded p-2">{i.desc}</p>
                            <details className="text-xs">
                              <summary className="text-slate-400 cursor-pointer">流转记录（{i.history.length}）</summary>
                              <ul className="mt-1 space-y-1 pl-3 border-l">
                                {i.history.map((h, j) => <li key={j} className="text-slate-500">{h.at} · {h.action} · {h.by}{h.note ? ` · ${h.note}` : ''}</li>)}
                              </ul>
                            </details>
                            {trans.length > 0 && (
                              <div className="flex gap-2 flex-wrap">
                                {trans.map(t => (
                                  <Button key={t.action} size="sm" variant="outline" className="h-7 text-xs"
                                    onClick={() => openDialog(i, t)}>
                                    {t.action} <ArrowRight className="w-3 h-3 ml-1" />{ISSUE_STATUS_META[t.to]}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {open === 0 && <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1.5">✓ 该对象全部问题已闭环</p>}
                </CardContent>
              </Card>
            )
          })}
          {objects.length === 0 && <p className="text-sm text-slate-400">本组织暂无问题单</p>}
          <Pager page={objsPg.page} totalPages={objsPg.totalPages} total={objsPg.total} onChange={objsPg.setPage} />
        </div>
      </div>

      {/* 流转对话框 */}
      <Dialog open={dialog != null} onOpenChange={o => { if (!o) setDialog(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">{dialog?.trans.action} → {dialog ? ISSUE_STATUS_META[dialog.trans.to] : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-slate-500">{dialog?.issue.title}</p>
            {dialog?.trans.assign && (
              <div className="flex gap-2">
                <label className="space-y-1 flex-1"><span className="text-xs text-slate-500">责任单位</span>
                  <Input value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="派单至责任单位" /></label>
                <label className="space-y-1"><span className="text-xs text-slate-500">整改期限</span>
                  <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
              </div>
            )}
            <label className="space-y-1 block"><span className="text-xs text-slate-500">{dialog?.trans.needNote ? '补充说明 *（如：纳入下一年度改造计划、权属待确认等）' : '备注说明'}</span>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder={dialog?.trans.needNote ? '请说明暂不立案的原因（必填）' : '整改情况 / 复查意见 / 备注（可选）'} /></label>
            <PhotoPicker label="佐证照片（可选）" photos={photos} onChange={setPhotos} />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialog(null)}>取消</Button>
            <Button size="sm" disabled={advanceIssue.isPending} onClick={() => void confirmAdvance()}>确认{dialog?.trans.action}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
