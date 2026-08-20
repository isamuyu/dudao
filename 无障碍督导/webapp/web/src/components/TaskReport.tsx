import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { fileUrl } from '@/api/client'
import { useTaskDetail } from '@/api/hooks'
import { useAuth } from '@/auth/AuthContext'
import type { Inspection, TaskLogEntry } from '@/api/types'
import { ISSUE_STATUS_META, POINT_STATUS_META } from '@/store/app'
import { buildFacilityRows, facilityName, LEVEL_META, SUBTYPE_MAP } from '@/data/checklib'
import { exportInspectionWord } from '@/report/wordReport'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, ClipboardList, FileText, FileDown, History, Loader2, MapPin, MinusCircle, XCircle } from 'lucide-react'

const TASK_STATUS: Record<string, { label: string; cls: string }> = {
  pool: { label: '待领取', cls: 'bg-sky-100 text-sky-700' },
  todo: { label: '待执行', cls: 'bg-amber-100 text-amber-700' },
  doing: { label: '督导中', cls: 'bg-blue-100 text-blue-700' },
  done: { label: '已完成', cls: 'bg-green-100 text-green-700' },
  blocked: { label: '无法督导结办', cls: 'bg-purple-100 text-purple-700' },
}
const COLLECT_LABEL: Record<string, string> = {
  ok: '允许督导', no_enter: '无法督导-不允许进入', closed: '无法督导-关闭',
  construct: '无法督导-施工', occupied: '无法督导-被占用', missing: '无法督导-不存在', damaged: '无法督导-损坏',
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—')

function Photos({ ids }: { ids?: string[] }) {
  if (!ids?.length) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1">
      {ids.map(id => (
        <a key={id} href={fileUrl(id)} target="_blank" rel="noreferrer">
          <img src={fileUrl(id)} alt="" className="w-16 h-16 object-cover rounded border bg-slate-100" loading="lazy" />
        </a>
      ))}
    </div>
  )
}

/** 任务日志时间线 */
function Timeline({ log }: { log: TaskLogEntry[] }) {
  return (
    <ol className="relative border-l border-teal-200 ml-1.5 space-y-2.5">
      {log.map((e, i) => (
        <li key={i} className="ml-3">
          <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-teal-600 border-2 border-white" />
          <p className="text-xs font-medium leading-tight">{e.event}{e.by ? <span className="text-slate-400 font-normal"> · {e.by}</span> : null}</p>
          <p className="text-[11px] text-slate-400">{fmt(e.at)}</p>
        </li>
      ))}
    </ol>
  )
}

/** 单次检查记录报告 */
function InspectionReport({ insp, pointSubtype, issues }: { insp: Inspection; pointSubtype: string; issues: { id: string; inspectionId?: string; title: string; status: string; severity: string }[] }) {
  const rows = useMemo(() => buildFacilityRows(pointSubtype), [pointSubtype])
  const rowOf = useMemo(() => Object.fromEntries(rows.map(r => [r.facility, r])), [rows])
  const myIssues = issues.filter(i => i.inspectionId === insp.id)
  /** 缺失设施（按检查项库重算）：无实例且 level ≠ R */
  const present = new Set(insp.instances.map(x => x.facility))
  const missing = rows.filter(r => !present.has(r.facility) && r.level !== 'R')
  const cond = new Set(insp.condTriggered ?? [])

  return (
    <Card>
      <CardHeader className="py-2.5 px-3">
        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
          <FileText className="w-4 h-4 text-teal-700" />督导报告
          <span className="text-xs font-normal text-slate-500">{insp.inspectorName} · {fmt(insp.submittedAt)} · 检查项库 v{insp.checklibVersion}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 space-y-3 text-xs">
        {/* 主体信息 */}
        <div className="border rounded-md p-2.5 bg-slate-50/60 space-y-1">
          <p className="font-medium text-slate-700">主体信息</p>
          <p className="text-slate-600">
            {insp.mainInfo.floors ? `楼层 ${insp.mainInfo.floors} 层 · ` : ''}{insp.mainInfo.nature} · {COLLECT_LABEL[insp.mainInfo.collectStatus] ?? insp.mainInfo.collectStatus}
            {insp.mainInfo.contact ? ` · 联系人 ${insp.mainInfo.contact} ${insp.mainInfo.contactPhone}` : ''}
          </p>
          {insp.mainInfo.note && <p className="text-slate-500">备注：{insp.mainInfo.note}</p>}
          <Photos ids={insp.mainInfo.photos} />
        </div>

        {/* 设施实例核查结果 */}
        {insp.instances.length > 0 && (
          <div className="space-y-2">
            <p className="font-medium text-slate-700">设施核查（{insp.instances.length} 个实例）</p>
            {insp.instances.map(ins => {
              const row = rowOf[ins.facility]
              return (
                <div key={ins.id} className="border rounded-md p-2.5 space-y-1.5">
                  <p className="font-medium flex items-center gap-1.5 flex-wrap">
                    {facilityName(ins.facility)} 实例{String(ins.no).padStart(2, '0')}
                    {row && <Badge variant="secondary" className="text-[10px]">{LEVEL_META[row.level].label}</Badge>}
                    {ins.applicable === false && <Badge variant="outline" className="text-[10px] text-slate-500">本处不涉及</Badge>}
                    {ins.locationDesc && <span className="text-slate-400 font-normal">{ins.locationDesc}</span>}
                  </p>
                  {ins.note && <p className="text-slate-500">备注：{ins.note}</p>}
                  <Photos ids={ins.photos} />
                  {ins.applicable === false && (
                    <p className="text-slate-400">已标记"本处不涉及该服务设施"，未逐项评测，不作为缺失、不生成问题单。</p>
                  )}
                  {ins.applicable !== false && (() => {
                    const allItems = [
                      ...(row?.items ?? []),
                      ...(ins.customItems ?? []).map(c => ({ key: c.key, aspect: c.aspect, requirement: c.requirement, clause: '督导员现场补充条款' })),
                    ]
                    if (allItems.length === 0) return null
                    return (
                      <ul className="divide-y border rounded">
                        {allItems.map(it => {
                          const r = ins.checks[it.key]
                          return (
                            <li key={it.key} className="flex items-start gap-1.5 px-2 py-1">
                              {r?.verdict === 'pass' ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-px" />
                                : r?.verdict === 'fail' ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-px" />
                                : <MinusCircle className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-px" />}
                              <span className="flex-1">{it.aspect}
                                <span className="text-slate-400">（{it.requirement} {it.clause}）</span></span>
                              {r?.measured && <span className="text-slate-500 shrink-0">实测 {r.measured}</span>}
                            </li>
                          )
                        })}
                      </ul>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )}

        {/* 缺失设施 */}
        {missing.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium text-slate-700">缺失设施（{missing.length}）</p>
            <ul className="border rounded divide-y">
              {missing.map(r => (
                <li key={r.facility} className="px-2 py-1 flex items-center gap-1.5">
                  <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${r.level === 'M' || cond.has(r.facility) ? 'text-red-500' : 'text-slate-300'}`} />
                  <span className={`flex-1 ${LEVEL_META[r.level].tone}`}>{LEVEL_META[r.level].symbol} {facilityName(r.facility)}</span>
                  <span className="text-slate-400">
                    {r.level === 'M' ? '必须项缺失' : cond.has(r.facility) ? '条件触发·已立案' : '条件未触发·未立案'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 生成的问题单 */}
        {myIssues.length > 0 && (
          <div className="space-y-1">
            <p className="font-medium text-slate-700">本次督导生成问题单（{myIssues.length}）</p>
            <ul className="border rounded divide-y">
              {myIssues.map(i => (
                <li key={i.id} className="px-2 py-1 flex items-center gap-1.5">
                  <span className="flex-1">{i.title}</span>
                  <Badge variant="outline" className="text-[10px]">{ISSUE_STATUS_META[i.status as keyof typeof ISSUE_STATUS_META] ?? i.status}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** 督导任务报告页（Web/移动版共用）：任务日志 + 每次现场检查的督导报告（含照片） */
export default function TaskReport({ taskId, onBack }: { taskId: string; onBack: () => void }) {
  const { org } = useAuth()
  const { data, isLoading } = useTaskDetail(taskId)
  const [exporting, setExporting] = useState(false)

  const exportWord = async () => {
    if (!data) return
    setExporting(true)
    try {
      await exportInspectionWord(data, org?.name)
      toast.success('督导报告 Word 已导出')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '导出失败')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading || !data) {
    return <div className="h-full flex items-center justify-center text-teal-800"><Loader2 className="w-5 h-5 animate-spin mr-2" />加载报告…</div>
  }
  const { task, point, inspections, issues, log } = data
  const st = SUBTYPE_MAP[point.subtypeId]
  const sm = POINT_STATUS_META[point.status]
  const ts = TASK_STATUS[task.status]
  const sortedInsps = [...inspections].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-3xl mx-auto p-3 md:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4" />返回</Button>
          <h2 className="text-base font-semibold truncate flex-1">{point.name}{st?.star && <span className="text-amber-500"> ★</span>}</h2>
          <Badge variant="secondary" className={ts.cls + ' text-[11px] shrink-0'}>{ts.label}</Badge>
          <Button size="sm" className="shrink-0" disabled={exporting || inspections.length === 0} onClick={() => void exportWord()}>
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}导出 Word
          </Button>
        </div>
        <p className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
          <MapPin className="w-3 h-3" />{point.address} · {point.kind === 'road' ? '道路线段' : st?.name} · {point.nature}
          <Badge style={{ backgroundColor: sm.color }} className="text-white text-[10px] ml-1">点位：{sm.label}</Badge>
        </p>

        {/* 任务日志 */}
        <Card>
          <CardHeader className="py-2.5 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-teal-700" />任务日志
              <span className="text-xs font-normal text-slate-400">{task.title} · 截止 {task.deadline}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3"><Timeline log={log} /></CardContent>
        </Card>

        {/* 督导报告（每次提交一份） */}
        {sortedInsps.length === 0 && (
          <p className="text-xs text-slate-400 bg-white border rounded-md p-3 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4" />尚未提交检查记录，暂无督导报告。
          </p>
        )}
        {sortedInsps.map(insp => (
          <InspectionReport key={insp.id} insp={insp} pointSubtype={point.subtypeId} issues={issues} />
        ))}

        {sortedInsps.some(i => (i.mainInfo.photos?.length ?? 0) === 0 && i.instances.every(x => (x.photos?.length ?? 0) === 0)) && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1"><Camera className="w-3 h-3" />部分检查记录未附现场照片。</p>
        )}
      </div>
    </div>
  )
}
