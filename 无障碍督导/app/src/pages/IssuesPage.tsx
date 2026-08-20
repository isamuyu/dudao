import { useState } from 'react'
import { useStore, useCurrent, ISSUE_STATUS_META, POINT_STATUS_META, type Issue, type IssueStatus } from '@/store/app'
import { facilityName, SUBTYPE_MAP } from '@/data/checklib'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronDown, ChevronRight, Route } from 'lucide-react'

const SEV: Record<string, { label: string; cls: string }> = {
  M: { label: '违反强制性条文', cls: 'bg-red-100 text-red-700' },
  C: { label: '一般问题', cls: 'bg-amber-100 text-amber-700' },
  R: { label: '建议改进', cls: 'bg-sky-100 text-sky-700' },
}
const FLOW: { from: IssueStatus; to: IssueStatus; action: string }[] = [
  { from: 'open', to: 'assigned', action: '审核立案并派单至责任单位' },
  { from: 'assigned', to: 'fixing', action: '责任单位签收，开始整改' },
  { from: 'fixing', to: 'recheck', action: '责任单位反馈整改完成，上传照片' },
  { from: 'recheck', to: 'closed', action: '现场复查通过，闭环销号' },
]

export default function IssuesPage() {
  const { state, dispatch } = useStore()
  const { org, user } = useCurrent()
  const issues = state.issues.filter(i => i.orgId === org.id)
  /** 展开的问题单 id（默认全部折叠，点击标题行展开详情） */
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const toggleExpand = (id: string) => setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))

  // 以建筑/道路为单位分组管理
  const objects = state.points
    .filter(p => p.orgId === org.id && issues.some(i => i.pointId === p.id))
    .map(p => {
      const list = issues.filter(i => i.pointId === p.id)
      return { point: p, list, open: list.filter(i => i.status !== 'closed').length, closed: list.filter(i => i.status === 'closed').length }
    })

  const nextStep = (i: Issue) => FLOW.find(f => f.from === i.status)

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" /> 问题整改闭环
          <span className="text-xs font-normal text-slate-400">以建筑/道路为单位管理 · 督导发现的问题进入待闭环 → 立案 → 派单 → 整改 → 复查 → 闭环销号</span>
        </h2>

        <div className="space-y-4">
          {objects.map(({ point, list, open, closed }) => {
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
                    const nx = nextStep(i)
                    const expanded = !!expandedIds[i.id]
                    return (
                      <div key={i.id} className={`rounded-md border ${i.status === 'closed' ? 'bg-green-50/40 border-green-200' : 'bg-white'}`}>
                        {/* 标题行（默认折叠，点击展开详情） */}
                        <button type="button" className="w-full flex items-center gap-2 flex-wrap text-left p-3 cursor-pointer select-none" onClick={() => toggleExpand(i.id)}>
                          {expanded
                            ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                          {i.status === 'closed'
                            ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                            : <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />}
                          <span className="font-medium text-sm">{i.title}</span>
                          <Badge variant="secondary" className={SEV[i.severity].cls + ' text-[11px]'}>{SEV[i.severity].label}</Badge>
                          <Badge variant="outline" className="text-[11px]">{ISSUE_STATUS_META[i.status]}</Badge>
                          <span className="flex-1" />
                          <span className="text-[11px] text-slate-400">{facilityName(i.facility)}{expanded ? ' · 点击收起' : ' · 点击展开'}</span>
                        </button>
                        {expanded && (
                          <div className="px-3 pb-3 space-y-1.5 border-t pt-2">
                            <p className="text-xs text-slate-500">{facilityName(i.facility)} · 条款：{i.clause}</p>
                            <p className="text-xs text-slate-600 bg-slate-50 rounded p-2">{i.desc}</p>
                            <details className="text-xs">
                              <summary className="text-slate-400 cursor-pointer">流转记录（{i.history.length}）</summary>
                              <ul className="mt-1 space-y-1 pl-3 border-l">
                                {i.history.map((h, j) => <li key={j} className="text-slate-500">{h.at} · {h.action} · {h.by}</li>)}
                              </ul>
                            </details>
                            {nx && (
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                onClick={() => dispatch({ type: 'ADVANCE_ISSUE', issueId: i.id, action: nx.action, by: user.name.replace(/（.*）/, ''), to: nx.to })}>
                                {nx.action} <ArrowRight className="w-3 h-3 ml-1" />{ISSUE_STATUS_META[nx.to]}
                              </Button>
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
        </div>
      </div>
    </div>
  )
}
