import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { uid, distM, type InstanceResult, type MainInfo, type Point, type Task } from '@/store/app'
import { useAuth } from '@/auth/AuthContext'
import { usePointLib, usePoints, useReleaseTask, useSubmitInspection, useTaskDetail, useTasks } from '@/api/hooks'
import { buildFacilityRowsFrom, facilityNameFrom, LEVEL_META, judgeParam, SUBTYPE_MAP, type CheckItem, type FacilityRow } from '@/data/checklib'
import PhotoPicker from '@/components/PhotoPicker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Armchair, ArrowUpDown, ArrowUpNarrowWide, Accessibility, Bath, BedDouble, BellRing, Car, CheckCircle2, ChevronLeft, ChevronRight, CirclePlus, Compass, DoorClosed, DoorOpen, Download, FileText, Loader2, Lock, MapPin, Plus, Printer, Route, SeparatorHorizontal, ShowerHead, Signpost, Table, Toilet, TrendingUp, Trash2, Waypoints, XCircle, type LucideIcon } from 'lucide-react'

/** 设施类别图标（图标卡片式选择） */
const FACILITY_ICONS: Record<string, LucideIcon> = {
  entrance: DoorOpen,
  ramp: TrendingUp,
  passage: Route,
  door: DoorClosed,
  elevator: ArrowUpDown,
  stairs: ArrowUpNarrowWide,
  toilet: Toilet,
  bathroom: Bath,
  room: BedDouble,
  parking: Car,
  seat: Armchair,
  lowdesk: Table,
  blindpath: Waypoints,
  handrail: SeparatorHorizontal,
  signage: Signpost,
  shower: ShowerHead,
  alarm: BellRing,
  guide: Compass,
  curbramp: TrendingUp,
  other: CirclePlus,
}
const LEVEL_BADGE: Record<string, { text: string; cls: string }> = {
  M: { text: '● 必须', cls: 'bg-red-600 text-white' },
  C: { text: '○ 条件', cls: 'bg-amber-500 text-white' },
  R: { text: '△ 推荐', cls: 'bg-sky-500 text-white' },
}

const COLLECT_STATUS = [
  { id: 'ok', label: '允许督导' },
  { id: 'no_enter', label: '无法督导-不允许进入' },
  { id: 'closed', label: '无法督导-关闭' },
  { id: 'construct', label: '无法督导-施工' },
  { id: 'occupied', label: '无法督导-被占用' },
  { id: 'missing', label: '无法督导-不存在' },
  { id: 'damaged', label: '无法督导-损坏' },
]
const STEPS = ['建筑主体信息', '设施核查', '汇总提交']
const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

interface FailedEntry { ins: InstanceResult; item: CheckItem }
interface MissingEntry { row: FacilityRow }

interface Draft {
  step: number
  main: MainInfo
  instances: InstanceResult[]
  condTriggered?: string[]
}

function loadDraft(taskId: string): Draft | null {
  try {
    const raw = localStorage.getItem(`wza-draft-${taskId}`)
    return raw ? JSON.parse(raw) as Draft : null
  } catch { return null }
}

export default function InspectPage({ taskId, onExit }: { taskId: string; onExit: () => void }) {
  const { data: tasks = [], isLoading: lt } = useTasks()
  const { data: points = [], isLoading: lp } = usePoints()
  const task = tasks.find(t => t.id === taskId)
  const point = points.find(p => p.id === task?.pointId)

  if (lt || lp) {
    return <div className="h-full flex items-center justify-center text-teal-800"><Loader2 className="w-5 h-5 animate-spin mr-2" />加载任务中…</div>
  }
  if (!task || !point) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
        <p>任务不存在或已结办</p>
        <Button variant="outline" size="sm" onClick={onExit}><ChevronLeft className="w-4 h-4" />返回</Button>
      </div>
    )
  }
  return <InspectInner key={task.id} task={task} point={point} onExit={onExit} />
}

function InspectInner({ task, point, onExit }: { task: Task; point: Point; onExit: () => void }) {
  const { user } = useAuth()
  const releaseTask = useReleaseTask()
  const submitInspection = useSubmitInspection()
  const subtype = SUBTYPE_MAP[point.subtypeId]
  const lib = usePointLib(point)   // 点位所属行动选用的检查项配置
  const facilityRows = useMemo(() => buildFacilityRowsFrom(lib, point.subtypeId), [lib, point.subtypeId])
  const fname = (id: string) => facilityNameFrom(lib, id)
  const rowOf = useMemo(() => Object.fromEntries(facilityRows.map(r => [r.facility, r])), [facilityRows])

  const draftKey = `wza-draft-${task.id}`
  const [draft] = useState<Draft | null>(() => loadDraft(task.id))

  const defaultMain = (): MainInfo => ({ floors: '', nature: point.nature, contact: '', contactPhone: point.contact, collectStatus: 'ok', note: '', photos: [] })
  // 旧版草稿照片字段（门脸/全景）迁移合并到 photos
  const migratedMain = (m?: MainInfo): MainInfo => {
    if (!m) return defaultMain()
    const legacy = m as MainInfo & { doorFace?: string[]; panoOut?: string[]; panoIn?: string[] }
    return { ...defaultMain(), ...m, photos: m.photos ?? [...(legacy.doorFace ?? []), ...(legacy.panoOut ?? []), ...(legacy.panoIn ?? [])] }
  }
  // 旧版草稿为 4 步（0主体 1选设施 2核查 3汇总），迁移为 3 步（0主体 1核查 2汇总）
  const migratedStep = (s?: number) => (s == null || s <= 0 ? 0 : s >= 3 ? 2 : 1)
  const [step, setStep] = useState(migratedStep(draft?.step))
  const [main, setMain] = useState<MainInfo>(() => migratedMain(draft?.main))
  const [instances, setInstances] = useState<InstanceResult[]>(draft?.instances ?? [])
  const [condTriggered, setCondTriggered] = useState<string[]>(draft?.condTriggered ?? [])   // 条件缺失项中确认"触发条件已满足"的设施
  const [cur, setCur] = useState(0)
  const [adding, setAdding] = useState(false)   // 是否展开"添加设施"选择面板
  const [submitted, setSubmitted] = useState(false)

  /** 退回补充：无本地草稿时，自动载入上次提交的检查数据（设施实例/判定/条件确认不丢失） */
  const { data: taskDetail } = useTaskDetail(draft ? null : task.id)
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || draft || !taskDetail) return
    prefilled.current = true
    const last = [...(taskDetail.inspections ?? [])].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
    if (!last) return
    setMain(migratedMain(last.mainInfo))
    setInstances(last.instances.map(x => ({ ...x, checks: { ...x.checks }, photos: [...(x.photos ?? [])] })))
    setCondTriggered([...(last.condTriggered ?? [])])
    if (last.instances.length > 0) setStep(1)
    toast.info('已载入上次提交的核查数据，可在其基础上补充修改')
  }, [taskDetail, draft])

  /** 草稿自动保存（debounce 500ms） */
  const saveTimer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (submitted) return
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ step, main, instances, condTriggered } satisfies Draft))
    }, 500)
    return () => window.clearTimeout(saveTimer.current)
  }, [step, main, instances, condTriggered, submitted, draftKey])

  const clearDraft = () => localStorage.removeItem(draftKey)

  const discardDraft = () => {
    if (!confirm('放弃已保存的草稿，恢复为空白表单？')) return
    clearDraft()
    setStep(0); setMain(defaultMain()); setInstances([]); setCondTriggered([]); setCur(0)
    toast.success('草稿已清除')
  }

  /** 设施实例的添加/删除（在核查步内直接操作） */
  const countOf = (fac: string) => instances.filter(x => x.facility === fac).length
  const insHasData = (x: InstanceResult) =>
    Object.keys(x.checks).length > 0 || (x.photos?.length ?? 0) > 0 || !!x.note || !!x.locationDesc
  const addInstance = (fac: string) => {
    // 实例被添加即代表现场设有该设施，直接进入逐项核查（不再单独做适用性判断；未设置的设施按"缺失"处理）
    const ins: InstanceResult = { id: uid('ins'), facility: fac, no: countOf(fac) + 1, locationDesc: '', applicable: true, checks: {}, photos: [] }
    setInstances(prev => [...prev, ins])
    setCur(instances.length)   // 聚焦新实例
  }
  const removeInstance = (id: string) => {
    const target = instances.find(x => x.id === id)
    if (!target) return
    if (insHasData(target) && !confirm(`「${fname(target.facility)} 实例${String(target.no).padStart(2, '0')}」已有填写的核查数据，删除后不可恢复，确认删除？`)) return
    const next = instances.filter(x => x.id !== id)
    // 同设施实例重新顺序编号
    const renumbered = next.map(x => {
      if (x.facility !== target.facility) return x
      const idx = next.filter(y => y.facility === x.facility).indexOf(x)
      return { ...x, no: idx + 1 }
    })
    setInstances(renumbered)
    setCur(c => Math.max(0, Math.min(c, renumbered.length - 1)))
  }

  const updIns = (id: string, patch: Partial<InstanceResult>) =>
    setInstances(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
  const updCheck = (id: string, key: string, patch: { measured?: string; verdict?: 'pass' | 'fail' }) =>
    setInstances(prev => prev.map(x => x.id === id ? { ...x, checks: { ...x.checks, [key]: { ...x.checks[key], ...patch } } } : x))

  /** 自定义条款（任意设施均可现场增补，按"建议改进"级处理）：与模板检查点合并参与判定 */
  const allItemsOf = (ins: InstanceResult, row: FacilityRow): CheckItem[] => [
    ...row.items,
    ...(ins.customItems ?? []).map(c => ({
      key: c.key, subtype: point.subtypeId, facility: ins.facility,
      aspect: c.aspect, requirement: c.requirement, clause: '督导员现场补充条款', level: 'R' as const,
    })),
  ]
  const [newClause, setNewClause] = useState({ aspect: '', requirement: '' })
  const addCustomItem = (insId: string) => {
    if (!newClause.aspect.trim() || !newClause.requirement.trim()) { toast.error('请填写条款名称与条款内容'); return }
    const item = { key: uid('c'), aspect: newClause.aspect.trim(), requirement: newClause.requirement.trim() }
    setInstances(prev => prev.map(x => x.id === insId ? { ...x, customItems: [...(x.customItems ?? []), item] } : x))
    setNewClause({ aspect: '', requirement: '' })
  }
  const removeCustomItem = (insId: string, key: string) =>
    setInstances(prev => prev.map(x => {
      if (x.id !== insId) return x
      const checks = { ...x.checks }
      delete checks[key]
      return { ...x, customItems: (x.customItems ?? []).filter(c => c.key !== key), checks }
    }))

  const blocked = main.collectStatus !== 'ok'

  /** 缺失项：未添加实例的必须/条件设施 */
  const missing: MissingEntry[] = facilityRows
    .filter(r => countOf(r.facility) === 0 && r.level !== 'R')
    .map(row => ({ row }))
  /** 将立案的缺失项：必须项全部立案；条件项仅当已确认触发条件 */
  const missingIssues = missing.filter(({ row }) => row.level === 'M' || condTriggered.includes(row.facility))
  const toggleCond = (fac: string, triggered: boolean) =>
    setCondTriggered(prev => triggered ? [...new Set([...prev, fac])] : prev.filter(f => f !== fac))

  const isAnswered = (x: InstanceResult) => {
    if (x.applicable === false) return true   // 兼容旧草稿
    const row = rowOf[x.facility]
    return !!row && allItemsOf(x, row).every(it => x.checks[it.key]?.verdict != null)
  }
  const answered = instances.filter(isAnswered).length

  const failed: FailedEntry[] = instances.flatMap(ins => {
    const row = rowOf[ins.facility]
    if (!row || ins.applicable !== true) return []
    return allItemsOf(ins, row).filter(it => ins.checks[it.key]?.verdict === 'fail').map(item => ({ ins, item }))
  })

  const submit = async () => {
    try {
      await submitInspection.mutateAsync({ taskId: task.id, mainInfo: main, instances, condTriggered })
      clearDraft()
      setSubmitted(true)
      toast.success(blocked ? '已按"无法督导"提交结办' : '检查记录已提交，问题单已自动生成')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '提交失败')
    }
  }

  const exit = async () => {
    if (submitted) { onExit(); return }
    try {
      await releaseTask.mutateAsync(task.id)   // 暂存退出：doing → todo，草稿保留在本地
      onExit()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '暂存退出失败')
    }
  }

  /** ===== 导出（继续用本地数据） ===== */
  const aspectRows = () => instances.flatMap(ins => {
    const row = rowOf[ins.facility]
    if (!row) return []
    return allItemsOf(ins, row).map(item => ({ ins, item, res: ins.checks[item.key] }))
  })
  const exportJSON = () => {
    const data = { point: { name: point.name, address: point.address, subtype: subtype?.name, lat: point.lat, lng: point.lng }, mainInfo: main, instances, missingFacilities: missing.map(m => fname(m.row.facility)), exportedAt: new Date().toISOString() }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = `${point.name}-核验数据.json`; a.click()
  }
  const exportCSV = () => {
    const rows = [['设施类别', '实例编号', '位置描述', '检查点', '配置等级', '标准要求', '条款依据', '实测值', '适用', '结论', '备注']]
    missing.forEach(({ row }) => rows.push([fname(row.facility), '-', '-', '（整项缺失）', LEVEL_META[row.level].label, row.typeNote ?? row.items[0]?.requirement ?? '', row.typeClause ?? '', '', '-', row.level === 'M' ? '不符合-必须项缺失' : condTriggered.includes(row.facility) ? '不符合-条件触发但未设置' : '条件未触发-不立案', '']))
    aspectRows().forEach(({ ins, item, res }) => {
      rows.push([fname(ins.facility), String(ins.no), ins.locationDesc, item.aspect, LEVEL_META[item.level].label, item.requirement, item.clause, res?.measured ?? '', ins.applicable === false ? '不适用' : '适用', ins.applicable === false ? '—' : res?.verdict === 'pass' ? '符合' : res?.verdict === 'fail' ? '不符合' : '未核查', ins.note ?? ''])
    })
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${point.name}-核验结果.csv`; a.click()
  }
  const printReport = () => {
    const w = window.open('', '_blank')!
    const rows = aspectRows().map(({ ins, item, res }) => {
      const r = ins.applicable === false ? '不适用' : res?.verdict === 'pass' ? '✓ 符合' : res?.verdict === 'fail' ? '✗ 不符合' : '未核查'
      return `<tr><td>${fname(ins.facility)}</td><td>${ins.no}</td><td>${ins.locationDesc}</td><td>${item.aspect}</td><td style="font-size:11px">${item.requirement}</td><td>${item.clause}</td><td>${res?.measured ?? ''}</td><td>${r}</td></tr>`
    }).join('')
    const missingRows = missing.map(({ row }) => `<tr style="background:${row.level === 'M' || condTriggered.includes(row.facility) ? '#fee2e2' : '#f1f5f9'}"><td>${fname(row.facility)}</td><td>-</td><td>-</td><td>整项缺失</td><td style="font-size:11px">${row.typeNote ?? row.items[0]?.requirement ?? ''}</td><td>${row.typeClause ?? ''}</td><td></td><td>${row.level === 'M' ? '✗ 必须项缺失' : condTriggered.includes(row.facility) ? '✗ 条件触发但未设置' : '— 条件未触发（不立案）'}</td></tr>`).join('')
    w.document.write(`<html><head><meta charset="utf-8"><title>无障碍设施核验结果表</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;font-size:12px}h1{font-size:18px}</style></head><body>
      <h1>无障碍设施核验结果表</h1>
      <p>点位：${point.name}（${subtype?.name}）&emsp;地址：${point.address}&emsp;GPS：${point.lat}, ${point.lng}&emsp;检查人：${user?.name}&emsp;时间：${new Date().toLocaleString('zh-CN')}</p>
      <p>设施实例 ${instances.length}&emsp;已核查 ${answered}&emsp;缺失设施 ${missing.length}&emsp;不合格检查点 ${failed.length}</p>
      <table><tr><th>设施类别</th><th>编号</th><th>位置</th><th>检查点</th><th>标准要求</th><th>条款</th><th>实测</th><th>结论</th></tr>${missingRows}${rows}</table>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }

  const curIns = instances[cur]
  const curRow = curIns ? rowOf[curIns.facility] : undefined
  /** 是否显示"添加设施"面板（手动展开，或尚无实例时强制展示） */
  const showPicker = adding || instances.length === 0

  /** 步骤跳转：三步之间可自由回退（实例数据保留） */
  const goStep = (i: number) => {
    if (i === step) return
    if (i === 1) setCur(c => Math.max(0, Math.min(c, instances.length - 1)))
    setStep(i)
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        {/* 头部 */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">{point.name}{subtype?.star && <span className="text-amber-500"> ★重点配置对象</span>}</h2>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />{point.address} · {point.kind === 'road' ? `道路线段 · 约 ${distM(point.lat, point.lng, point.lat2!, point.lng2!)} 米` : subtype?.name} ·
              <Lock className="w-3 h-3 ml-1" />位置与类别由组织管理员锁定
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {!submitted && draft && (
              <Button variant="ghost" size="sm" className="text-slate-500" onClick={discardDraft}>
                <Trash2 className="w-4 h-4" />放弃草稿
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={releaseTask.isPending} onClick={() => void exit()}>
              <ChevronLeft className="w-4 h-4" />{submitted ? '返回任务列表' : '暂存退出'}
            </Button>
          </div>
        </div>

        {/* 步骤条（可点击回退，随时修改主体信息/增减设施） */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => goStep(i)}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-medium text-left transition-colors ${i === step ? 'bg-teal-700 text-white' : i < step ? 'bg-teal-100 text-teal-800 hover:bg-teal-200 cursor-pointer' : 'bg-white text-slate-400 border hover:bg-slate-50 cursor-pointer'}`}>
              第{i + 1}步 · {s}
            </button>
          ))}
        </div>

        {/* 第1步：建筑主体信息 */}
        {step === 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">{point.kind === 'road' ? '道路/路段主体信息录入' : '建筑主体信息录入'}（名称、位置、类别已锁定，仅补充现场实况）</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {point.kind === 'building' && (
                  <label className="space-y-1"><span className="text-xs text-slate-500">楼层数（影响电梯等条件项判定）</span>
                    <Input type="number" min={1} value={main.floors} onChange={e => setMain({ ...main, floors: e.target.value })} placeholder="如 6" /></label>
                )}
                <label className="space-y-1"><span className="text-xs text-slate-500">建设性质</span>
                  <select className={selCls + ' w-full'} value={main.nature} onChange={e => setMain({ ...main, nature: e.target.value })}>{['新建', '改建', '扩建', '既有'].map(n => <option key={n}>{n}</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs text-slate-500">现场联系人</span>
                  <Input value={main.contact} onChange={e => setMain({ ...main, contact: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs text-slate-500">联系电话</span>
                  <Input value={main.contactPhone} onChange={e => setMain({ ...main, contactPhone: e.target.value })} /></label>
              </div>
              <label className="space-y-1 block"><span className="text-xs text-slate-500">督导许可 *</span>
                <select className={selCls + ' w-full'} value={main.collectStatus} onChange={e => setMain({ ...main, collectStatus: e.target.value })}>
                  {COLLECT_STATUS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select></label>
              {blocked && <p className="text-xs text-purple-700 bg-purple-50 rounded p-2">已选择无法督导：提交后任务按"无法督导"结办，点位保留待下次督导。请在备注与照片中说明原因。</p>}
              <div className="border rounded-md p-3 bg-slate-50/50">
                <PhotoPicker label="建筑现场照片" photos={main.photos} onChange={v => setMain({ ...main, photos: v })} />
              </div>
              <Textarea placeholder="现场情况备注" value={main.note} onChange={e => setMain({ ...main, note: e.target.value })} />
              <div className="flex justify-end">
                {blocked
                  ? <Button variant="destructive" disabled={submitInspection.isPending} onClick={() => void submit()}>按"无法督导"提交结办</Button>
                  : <Button onClick={() => setStep(1)}>下一步：设施核查 <ChevronRight className="w-4 h-4" /></Button>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 第2步：设施核查（实例目录 + 添加设施 + 逐项核查 一体） */}
        {step === 1 && (
          <div className="grid grid-cols-[240px_1fr] gap-4">
            {/* 实例目录 */}
            <Card className="h-fit">
              <CardHeader className="py-3"><CardTitle className="text-sm">设施实例（{answered}/{instances.length}）</CardTitle></CardHeader>
              <CardContent className="p-2 space-y-1 max-h-[420px] overflow-auto">
                {instances.map((x, i) => {
                  const row = rowOf[x.facility]
                  const fails = row ? row.items.filter(it => x.checks[it.key]?.verdict === 'fail').length : 0
                  return (
                    <div key={x.id}
                      className={`w-full rounded px-2 py-1.5 flex items-center gap-1.5 text-xs ${i === cur && !showPicker ? 'bg-teal-700 text-white' : 'hover:bg-slate-100'}`}>
                      <button className="flex-1 min-w-0 text-left flex items-center gap-1.5" onClick={() => { setCur(i); setAdding(false) }}>
                        {x.applicable === false ? '—' : !isAnswered(x) ? <span className="w-3.5 h-3.5 rounded-full border inline-block shrink-0" /> : fails > 0 ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                        <span className="truncate">{fname(x.facility)} {String(x.no).padStart(2, '0')}{x.locationDesc ? ` · ${x.locationDesc}` : ''}</span>
                      </button>
                      <button className="shrink-0 opacity-50 hover:opacity-100 hover:text-red-500" title="删除该实例" onClick={() => removeInstance(x.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
                {instances.length === 0 && <p className="text-xs text-slate-400 px-2 py-3">尚未添加设施实例，请从右侧选择现场实际设有的设施。</p>}
              </CardContent>
              <div className="p-2 border-t">
                <Button variant={adding ? 'secondary' : 'outline'} size="sm" className="w-full h-8 text-xs" onClick={() => setAdding(!adding)}>
                  <Plus className="w-3.5 h-3.5 mr-1" />{adding ? '收起设施选择' : '添加设施实例'}
                </Button>
              </div>
            </Card>

            {/* 右侧：添加设施面板 或 核查表单 */}
            {showPicker ? (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base">添加设施实例
                      <span className="block text-xs font-normal text-slate-500 mt-1">按"建筑类型 × 配置矩阵"列出应配设施；<b>点击设施类型即添加一个实例</b>（同类设施有多处时点多次，如 3 个出入口、2 部电梯），随后在左侧目录逐个核查。<b className="text-red-600">必须项不添加将在提交时作为"设施缺失"问题单列案；</b><b className="text-amber-600">条件项不添加时需在第3步确认触发条件，条件不触发则不立案。</b></span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                    {facilityRows.map(row => {
                      const n = countOf(row.facility)
                      const Icon = FACILITY_ICONS[row.facility] ?? Accessibility
                      const lb = LEVEL_BADGE[row.level]
                      return (
                        <div key={row.facility}
                          onClick={() => addInstance(row.facility)}
                          className={`relative cursor-pointer rounded-lg border-2 p-3 transition-colors select-none hover:border-teal-500 hover:bg-teal-50/50 ${
                            n > 0 ? 'border-teal-600 bg-teal-50/60'
                            : row.level === 'M' ? 'border-red-300 border-dashed bg-red-50/30'
                            : 'border-slate-200 bg-white'}`}>
                          <span className={`absolute top-2 right-2 text-[10px] font-semibold rounded px-1.5 py-0.5 ${lb.cls}`}>{lb.text}</span>
                          <Icon className={`w-7 h-7 ${n > 0 ? 'text-teal-700' : row.level === 'M' ? 'text-red-400' : 'text-slate-400'}`} />
                          <p className="font-medium text-sm mt-1.5 pr-10">{fname(row.facility)}</p>
                          <p className="text-[11px] text-slate-400">{row.facility === 'other' ? '自定义条款 · 现场录入' : `${row.items.length} 个检查点`}{row.condition ? ` · 条件：${row.condition}` : ''}</p>
                          <p className="text-[11px] mt-1.5 h-4">
                            {n > 0
                              ? <span className="text-teal-700">✓ 已添加 {n} 处，再点继续添加</span>
                              : row.level === 'M'
                                ? <span className="text-red-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />缺失将列问题</span>
                                : <span className="text-slate-300">点击添加实例</span>}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t pt-3">
                    <p className="text-xs text-slate-500">
                      已添加 {facilityRows.filter(r => countOf(r.facility) > 0).length} 类设施、共 {instances.length} 个实例；
                      未添加的必须项 {missing.filter(m => m.row.level === 'M').length} 项、条件项 {missing.filter(m => m.row.level === 'C').length} 项。
                    </p>
                    {instances.length > 0
                      ? <Button size="sm" onClick={() => { setAdding(false); setCur(0) }}>完成添加，开始核查 <ChevronRight className="w-4 h-4" /></Button>
                      : <Button size="sm" variant="secondary" onClick={() => setStep(2)}>现场无相关设施，直接进入汇总 <ChevronRight className="w-4 h-4" /></Button>}
                  </div>
                </CardContent>
              </Card>
            ) : curIns && curRow ? (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className={`font-bold ${LEVEL_META[curRow.level].tone}`}>{LEVEL_META[curRow.level].symbol}</span>
                    {fname(curIns.facility)} · 实例 {String(curIns.no).padStart(2, '0')}
                    <Badge variant="secondary" className="text-[11px]">{LEVEL_META[curRow.level].label}</Badge>
                    <span className="text-xs font-normal text-slate-400">{curRow.items.length} 个检查点</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {/* 位置与取证：先描述设施在哪、拍现场照片，再逐项核查 */}
                  <div className="border rounded-md p-3 bg-slate-50/50 space-y-2">
                    <label className="space-y-1 block"><span className="text-xs text-slate-500">设施位置描述（如：南门东侧、1号楼首层）</span>
                      <Input value={curIns.locationDesc} onChange={e => updIns(curIns.id, { locationDesc: e.target.value })} /></label>
                    <PhotoPicker label="现场取证照片（自动附加时间/GPS/点位水印）" photos={curIns.photos ?? []} onChange={v => updIns(curIns.id, { photos: v })} />
                    {/* 基本设置：本处不涉及该服务设施 → 无需逐项评测，且不生成问题 */}
                    <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none border-t pt-2">
                      <input type="checkbox" className="accent-teal-700 mt-0.5"
                        checked={curIns.applicable === false}
                        onChange={e => updIns(curIns.id, { applicable: e.target.checked ? false : true })} />
                      <span>本处不涉及该服务设施<span className="text-slate-400">（勾选后无需逐项评测，不作为缺失也不生成问题单；可拍照/备注说明现场情况）</span></span>
                    </label>
                  </div>

                  {curIns.applicable === false && (
                    <p className="text-xs text-slate-500 bg-slate-100 rounded-md p-3">已标记"本处不涉及该服务设施"：本实例无需逐项评测，提交后不作为缺失、不生成问题单。</p>
                  )}

                  {curIns.applicable !== false && curRow.typeNote && (
                    <div className="border-l-4 border-teal-500 bg-teal-50/60 rounded-r-md p-3">
                      <p className="text-xs font-medium text-teal-800 mb-0.5">本建筑类型配置要求（{curRow.typeClause}）</p>
                      <p className="text-sm leading-relaxed">{curRow.typeNote}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                      {curIns.applicable !== false && curRow.items.map(item => {
                        const res = curIns.checks[item.key]
                        return (
                          <div key={item.key} className={`border rounded-md p-3 ${res?.verdict === 'fail' ? 'border-red-300 bg-red-50/40' : res?.verdict === 'pass' ? 'border-green-200 bg-green-50/30' : 'bg-white'}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.aspect}</span>
                              {item.param && <Badge variant="outline" className="text-[10px] text-teal-700 border-teal-300">数值自动判定</Badge>}
                              {item.condition && <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">条件：{item.condition}</Badge>}
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.requirement} <span className="text-slate-400">（{item.clause}）</span></p>
                            {item.param && (
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <Input className="w-36 h-8" type="number" step="any" placeholder={`实测值（${item.param.unit}）`}
                                  value={res?.measured ?? ''}
                                  onChange={e => {
                                    const v = e.target.value
                                    const num = parseFloat(v)
                                    updCheck(curIns.id, item.key, { measured: v, verdict: isNaN(num) ? undefined : judgeParam(item.param!, num) ? 'pass' : 'fail' })
                                  }} />
                                <span className="text-xs text-slate-400">阈值：{item.param.kind === 'min' ? '≥' + item.param.min : item.param.kind === 'max' ? '≤' + item.param.max : `${item.param.min}–${item.param.max}`}{item.param.unit}</span>
                                {res?.measured != null && res.measured !== '' && !isNaN(parseFloat(res.measured)) && (
                                  res.verdict === 'pass'
                                    ? <span className="text-xs text-green-600 font-medium">✓ 自动判定：满足要求</span>
                                    : <span className="text-xs text-red-600 font-medium">× 自动判定：不满足要求</span>
                                )}
                                {item.param.hint && <span className="text-[11px] text-slate-400 w-full">{item.param.hint}</span>}
                              </div>
                            )}
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" variant={res?.verdict === 'pass' ? 'default' : 'outline'} className={`h-7 text-xs ${res?.verdict === 'pass' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                onClick={() => updCheck(curIns.id, item.key, { verdict: 'pass' })}>满足要求</Button>
                              <Button size="sm" variant={res?.verdict === 'fail' ? 'destructive' : 'outline'} className="h-7 text-xs"
                                onClick={() => updCheck(curIns.id, item.key, { verdict: 'fail' })}>不满足要求</Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                  {/* 自定义条款（所有设施均可由督导员现场增补，条款内容自行录入） */}
                  {curIns.applicable !== false && (
                    <div className="space-y-2">
                      {(curIns.customItems ?? []).length === 0 && curIns.facility === 'other' && (
                        <p className="text-xs text-slate-400 border border-dashed rounded-md p-3">该设施无预设检查点，请在下方自行添加条款（条款内容由您录入，判定方式与标准条款一致）。</p>
                      )}
                      {(curIns.customItems ?? []).map(c => {
                        const res = curIns.checks[c.key]
                        return (
                          <div key={c.key} className={`border rounded-md p-3 ${res?.verdict === 'fail' ? 'border-red-300 bg-red-50/40' : res?.verdict === 'pass' ? 'border-green-200 bg-green-50/30' : 'bg-white'}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{c.aspect}</span>
                              <Badge variant="outline" className="text-[10px] text-purple-700 border-purple-300">自定义条款</Badge>
                              <span className="flex-1" />
                              <button className="text-slate-300 hover:text-red-500" title="删除该条款" onClick={() => removeCustomItem(curIns.id, c.key)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{c.requirement} <span className="text-slate-400">（督导员现场补充条款）</span></p>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" variant={res?.verdict === 'pass' ? 'default' : 'outline'} className={`h-7 text-xs ${res?.verdict === 'pass' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                onClick={() => updCheck(curIns.id, c.key, { verdict: 'pass' })}>满足要求</Button>
                              <Button size="sm" variant={res?.verdict === 'fail' ? 'destructive' : 'outline'} className="h-7 text-xs"
                                onClick={() => updCheck(curIns.id, c.key, { verdict: 'fail' })}>不满足要求</Button>
                            </div>
                          </div>
                        )
                      })}
                      <div className="border border-dashed border-purple-300 rounded-md p-3 bg-purple-50/40 space-y-2">
                        <p className="text-xs font-medium text-purple-800">添加自定义条款<span className="font-normal text-slate-400">（标准检查点之外的现场增补；不合格按"建议改进"立案）</span></p>
                        <Input placeholder="条款名称（如：无障碍饮水设施、母婴护理台）" value={newClause.aspect} onChange={e => setNewClause({ ...newClause, aspect: e.target.value })} />
                        <Textarea placeholder="条款内容 / 要求（自行录入判定依据）" value={newClause.requirement} onChange={e => setNewClause({ ...newClause, requirement: e.target.value })} />
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => addCustomItem(curIns.id)}>
                          <Plus className="w-3.5 h-3.5 mr-1" />添加条款
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* 备注 */}
                  <Textarea placeholder="现场情况 / 整改说明 / 备注" value={curIns.note ?? ''} onChange={e => updIns(curIns.id, { note: e.target.value })} />

                  <div className="flex justify-between pt-1">
                    <Button variant="outline" size="sm" disabled={cur === 0} onClick={() => setCur(cur - 1)}><ChevronLeft className="w-4 h-4" />上一项</Button>
                    {cur < instances.length - 1
                      ? <Button size="sm" onClick={() => setCur(cur + 1)}>下一项 <ChevronRight className="w-4 h-4" /></Button>
                      : <Button size="sm" onClick={() => setStep(2)}>完成核查，查看汇总 <ChevronRight className="w-4 h-4" /></Button>}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}

        {/* 第3步：汇总提交 */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="w-5 h-5" /> 核验结果汇总</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-4 gap-3">
                {([['设施实例', instances.length], ['已核查实例', answered], ['缺失设施', missing.length], ['不合格检查点', failed.length]] as [string, number][]).map(([l, v]) => (
                  <div key={l} className="border rounded-md p-3 text-center bg-white">
                    <p className="text-2xl font-bold text-teal-800">{v}</p><p className="text-xs text-slate-500">{l}</p>
                  </div>
                ))}
              </div>

              {missing.length > 0 && (
                <div className="border border-red-200 rounded-md">
                  <p className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 rounded-t-md">
                    设施缺失：必须项（●）提交后自动生成问题单；条件项（○）需确认触发条件，仅"条件触发"才立案
                  </p>
                  {missing.map(({ row }) => {
                    const triggered = condTriggered.includes(row.facility)
                    return (
                      <div key={row.facility} className="px-3 py-2 border-t text-xs flex gap-2 items-start">
                        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${row.level === 'M' || triggered ? 'text-red-500' : 'text-slate-300'}`} />
                        <div className="flex-1">
                          <p className="font-medium">缺少{row.level === 'M' ? '必须设置的' : '条件设置的'}{fname(row.facility)}
                            <Badge variant="secondary" className="ml-1 text-[10px]">{LEVEL_META[row.level].label}</Badge></p>
                          <p className="text-slate-500 mt-0.5">{row.typeNote ?? row.items[0]?.requirement}（{row.typeClause ?? row.items[0]?.clause}）</p>
                          {row.level === 'M'
                            ? <p className="text-red-600 mt-1">将自动生成问题单</p>
                            : (
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-slate-400">触发条件{row.condition ? `（${row.condition}）` : ''}是否满足？</span>
                                <Button size="sm" variant={triggered ? 'destructive' : 'outline'} className="h-6 text-[11px] px-2"
                                  onClick={() => toggleCond(row.facility, true)}>条件触发·确属缺失</Button>
                                <Button size="sm" variant={triggered ? 'outline' : 'secondary'} className="h-6 text-[11px] px-2"
                                  onClick={() => toggleCond(row.facility, false)}>条件不触发·不立案</Button>
                              </div>
                            )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {failed.length > 0 && (
                <div className="border border-red-200 rounded-md">
                  <p className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 rounded-t-md">不合格检查点明细（提交后自动生成问题单）</p>
                  {failed.map(({ ins, item }, i) => (
                    <div key={i} className="px-3 py-2 border-t text-xs flex gap-2 items-start">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{fname(ins.facility)} · {item.aspect} · 实例{String(ins.no).padStart(2, '0')}{ins.locationDesc ? `（${ins.locationDesc}）` : ''}
                          <Badge variant="secondary" className="ml-1 text-[10px]">{LEVEL_META[item.level].label}</Badge></p>
                        <p className="text-slate-500 mt-0.5">{item.requirement}（{item.clause}）{ins.checks[item.key]?.measured ? `｜实测：${ins.checks[item.key]!.measured}` : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {missing.length === 0 && failed.length === 0 && answered === instances.length && (
                <p className="text-sm text-green-700 bg-green-50 rounded-md p-3">✓ 全部检查点符合要求，无缺失设施，提交后点位标记为"已销号/合格"。</p>
              )}
              {missing.length > 0 && missingIssues.length === 0 && failed.length === 0 && (
                <p className="text-sm text-green-700 bg-green-50 rounded-md p-3">✓ 缺失项均为条件设置项且触发条件未满足，不生成问题单，提交后点位标记为"已销号/合格"。</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportJSON}><Download className="w-4 h-4 mr-1" />导出 JSON</Button>
                <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" />导出 CSV</Button>
                <Button variant="outline" size="sm" onClick={printReport}><Printer className="w-4 h-4 mr-1" />打印 / PDF</Button>
              </div>
              <div className="flex justify-between border-t pt-3">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4" />返回核查</Button>
                {submitted
                  ? <Badge className="bg-green-600 text-white px-4 py-2">✓ 已提交：检查记录已归档，问题单已生成</Badge>
                  : <Button onClick={() => void submit()} disabled={answered < instances.length || submitInspection.isPending}>提交检查{answered < instances.length ? `（剩余 ${instances.length - answered} 个实例未核查）` : ''}</Button>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
