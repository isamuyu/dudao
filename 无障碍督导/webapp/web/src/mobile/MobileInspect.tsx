import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { uid, type InstanceResult, type MainInfo, type Point, type Task } from '@/store/app'
import { usePointLib, usePoints, useReleaseTask, useSubmitInspection, useTaskDetail, useTasks } from '@/api/hooks'
import { buildFacilityRowsFrom, facilityNameFrom, LEVEL_META, judgeParam, SUBTYPE_MAP, type CheckItem, type FacilityRow } from '@/data/checklib'
import PhotoPicker from '@/components/PhotoPicker'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Accessibility, Armchair, ArrowUpDown, ArrowUpNarrowWide, Bath, BedDouble, BellRing, Car, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CirclePlus, Compass, DoorClosed, DoorOpen, Loader2, MapPin, Plus, Route, SeparatorHorizontal, ShowerHead, Signpost, Table, Toilet, Trash2, TrendingUp, Waypoints, XCircle, type LucideIcon } from 'lucide-react'

/** 设施类别图标（与桌面版一致） */
const FACILITY_ICONS: Record<string, LucideIcon> = {
  entrance: DoorOpen, ramp: TrendingUp, passage: Route, door: DoorClosed,
  elevator: ArrowUpDown, stairs: ArrowUpNarrowWide, toilet: Toilet, bathroom: Bath,
  room: BedDouble, parking: Car, seat: Armchair, lowdesk: Table,
  blindpath: Waypoints, handrail: SeparatorHorizontal, signage: Signpost,
  shower: ShowerHead, alarm: BellRing, guide: Compass, curbramp: TrendingUp,
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
const STEPS = ['主体信息', '设施核查', '汇总提交']
const selCls = 'h-10 rounded-md border border-input bg-background px-2 text-sm w-full'

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

/** 移动版现场检查：与桌面版同一检查项库、同一提交接口（POST /inspections）、同一草稿键 */
export default function MobileInspect({ taskId, onExit }: { taskId: string; onExit: () => void }) {
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
  return <Inner key={task.id} task={task} point={point} onExit={onExit} />
}

function Inner({ task, point, onExit }: { task: Task; point: Point; onExit: () => void }) {
  const releaseTask = useReleaseTask()
  const submitInspection = useSubmitInspection()
  const subtype = SUBTYPE_MAP[point.subtypeId]
  const lib = usePointLib(point)   // 点位所属行动选用的检查项配置
  const facilityRows = useMemo(() => buildFacilityRowsFrom(lib, point.subtypeId), [lib, point.subtypeId])
  const fname = (id: string) => facilityNameFrom(lib, id)
  const rowOf = useMemo(() => Object.fromEntries(facilityRows.map(r => [r.facility, r])), [facilityRows]) as Record<string, FacilityRow>

  const draftKey = `wza-draft-${task.id}`
  const [draft] = useState<Draft | null>(() => loadDraft(task.id))

  const defaultMain = (): MainInfo => ({ floors: '', nature: point.nature, contact: '', contactPhone: point.contact, collectStatus: 'ok', note: '', photos: [] })
  const migratedMain = (m?: MainInfo): MainInfo => (!m ? defaultMain() : { ...defaultMain(), ...m, photos: m.photos ?? [] })
  const migratedStep = (s?: number) => (s == null || s <= 0 ? 0 : s >= 3 ? 2 : s)

  const [step, setStep] = useState(migratedStep(draft?.step))
  const [main, setMain] = useState<MainInfo>(() => migratedMain(draft?.main))
  const [instances, setInstances] = useState<InstanceResult[]>(draft?.instances ?? [])
  const [condTriggered, setCondTriggered] = useState<string[]>(draft?.condTriggered ?? [])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState((draft?.instances?.length ?? 0) === 0)
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
    if (last.instances.length > 0) { setStep(1); setShowPicker(false) }
    toast.info('已载入上次提交的核查数据，可在其基础上补充修改')
  }, [taskDetail, draft])

  /** 草稿自动保存（debounce 500ms，与桌面版同一键位，可跨端续填） */
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

  const countOf = (fac: string) => instances.filter(x => x.facility === fac).length
  const insHasData = (x: InstanceResult) =>
    Object.keys(x.checks).length > 0 || (x.photos?.length ?? 0) > 0 || !!x.note || !!x.locationDesc
  const addInstance = (fac: string) => {
    const ins: InstanceResult = { id: uid('ins'), facility: fac, no: countOf(fac) + 1, locationDesc: '', applicable: true, checks: {}, photos: [] }
    setInstances(prev => [...prev, ins])
    setExpandedId(ins.id)
    setShowPicker(false)
  }
  const removeInstance = (id: string) => {
    const target = instances.find(x => x.id === id)
    if (!target) return
    if (insHasData(target) && !confirm(`「${fname(target.facility)} 实例${String(target.no).padStart(2, '0')}」已有填写的核查数据，删除后不可恢复，确认删除？`)) return
    const next = instances.filter(x => x.id !== id)
    setInstances(next.map(x => {
      if (x.facility !== target.facility) return x
      const idx = next.filter(y => y.facility === x.facility).indexOf(x)
      return { ...x, no: idx + 1 }
    }))
    if (expandedId === id) setExpandedId(null)
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
  const missing = facilityRows.filter(r => countOf(r.facility) === 0 && r.level !== 'R')
  const missingIssues = missing.filter(row => row.level === 'M' || condTriggered.includes(row.facility))
  const toggleCond = (fac: string, triggered: boolean) =>
    setCondTriggered(prev => triggered ? [...new Set([...prev, fac])] : prev.filter(f => f !== fac))

  const isAnswered = (x: InstanceResult) => {
    if (x.applicable === false) return true   // 已标记"本处不涉及"：无需评测
    const row = rowOf[x.facility]
    return !!row && allItemsOf(x, row).every(it => x.checks[it.key]?.verdict != null)
  }
  const answered = instances.filter(isAnswered).length
  const failed = instances.flatMap(ins => {
    const row = rowOf[ins.facility]
    if (!row) return []
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
      await releaseTask.mutateAsync(task.id)
      onExit()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '暂存退出失败')
    }
  }

  return (
    <div className="min-h-full flex flex-col">
      {/* 顶部：点位 + 步骤 */}
      <div className="sticky top-0 z-10 bg-white border-b px-3 py-2 space-y-1.5">
        <div className="flex items-center gap-2">
          <button className="text-slate-500 text-xs flex items-center shrink-0" onClick={() => void exit()}>
            <ChevronLeft className="w-4 h-4" />{submitted ? '返回' : '暂存退出'}
          </button>
          <p className="font-semibold text-sm truncate flex-1">{point.name}{subtype?.star && <span className="text-amber-500"> ★</span>}</p>
          <Badge variant="secondary" className="text-[10px] shrink-0">{point.kind === 'road' ? '道路线段' : subtype?.name}</Badge>
        </div>
        <p className="text-[11px] text-slate-400 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 shrink-0" />{point.address}</p>
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => !submitted && setStep(i)}
              className={`flex-1 rounded px-1 py-1 text-[11px] font-medium ${i === step ? 'bg-teal-700 text-white' : i < step ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-400'}`}>
              {i + 1}. {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-3 space-y-3 pb-6">
        {/* ===== 第1步：主体信息 ===== */}
        {step === 0 && (
          <Card>
            <CardContent className="p-3 space-y-3 text-sm">
              <p className="font-medium text-teal-800 text-xs">主体信息（名称/位置/类别已锁定，仅补充现场实况）</p>
              <div className="grid grid-cols-2 gap-2">
                {point.kind === 'building' && (
                  <label className="space-y-1"><span className="text-xs text-slate-500">楼层数</span>
                    <Input className="h-10" type="number" min={1} value={main.floors} onChange={e => setMain({ ...main, floors: e.target.value })} placeholder="如 6" /></label>
                )}
                <label className="space-y-1"><span className="text-xs text-slate-500">建设性质</span>
                  <select className={selCls} value={main.nature} onChange={e => setMain({ ...main, nature: e.target.value })}>{['新建', '改建', '扩建', '既有'].map(n => <option key={n}>{n}</option>)}</select></label>
                <label className="space-y-1"><span className="text-xs text-slate-500">现场联系人</span>
                  <Input className="h-10" value={main.contact} onChange={e => setMain({ ...main, contact: e.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs text-slate-500">联系电话</span>
                  <Input className="h-10" value={main.contactPhone} onChange={e => setMain({ ...main, contactPhone: e.target.value })} /></label>
              </div>
              <label className="space-y-1 block"><span className="text-xs text-slate-500">督导许可 *</span>
                <select className={selCls} value={main.collectStatus} onChange={e => setMain({ ...main, collectStatus: e.target.value })}>
                  {COLLECT_STATUS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select></label>
              {blocked && <p className="text-xs text-purple-700 bg-purple-50 rounded p-2">已选择无法督导：提交后任务按"无法督导"结办。请在备注与照片中说明原因。</p>}
              <div className="border rounded-md p-2.5 bg-slate-50/50">
                <PhotoPicker label="现场照片（拍照上传）" photos={main.photos} onChange={v => setMain({ ...main, photos: v })} />
              </div>
              <Textarea placeholder="现场情况备注" value={main.note} onChange={e => setMain({ ...main, note: e.target.value })} />
              {blocked
                ? <Button variant="destructive" className="w-full h-10" disabled={submitInspection.isPending} onClick={() => void submit()}>按"无法督导"提交结办</Button>
                : <Button className="w-full h-10" onClick={() => setStep(1)}>下一步：设施核查 <ChevronRight className="w-4 h-4" /></Button>}
            </CardContent>
          </Card>
        )}

        {/* ===== 第2步：设施核查 ===== */}
        {step === 1 && (
          <>
            {/* 添加设施面板 */}
            <Card>
              <button type="button" className="w-full flex items-center gap-2 px-3 py-2.5 text-left" onClick={() => setShowPicker(!showPicker)}>
                <Plus className="w-4 h-4 text-teal-700" />
                <span className="text-sm font-medium flex-1">添加设施实例
                  <span className="text-[11px] font-normal text-slate-400 ml-1">已添加 {instances.length} 个</span>
                </span>
                {showPicker ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {showPicker && (
                <CardContent className="px-3 pb-3 pt-0">
                  <p className="text-[11px] text-slate-500 mb-2">现场设有的设施逐一点击添加；<span className="text-red-600">必须项不添加将作为"缺失"立案</span>，条件项在汇总时确认触发条件。</p>
                  <div className="grid grid-cols-2 gap-2">
                    {facilityRows.map(row => {
                      const n = countOf(row.facility)
                      const Icon = FACILITY_ICONS[row.facility] ?? Accessibility
                      const lb = LEVEL_BADGE[row.level]
                      return (
                        <button key={row.facility} type="button" onClick={() => addInstance(row.facility)}
                          className={`relative rounded-lg border-2 p-2.5 text-left ${n > 0 ? 'border-teal-600 bg-teal-50/60' : row.level === 'M' ? 'border-red-300 border-dashed bg-red-50/30' : 'border-slate-200 bg-white'}`}>
                          <span className={`absolute top-1.5 right-1.5 text-[9px] font-semibold rounded px-1 py-0.5 ${lb.cls}`}>{lb.text}</span>
                          <Icon className={`w-5 h-5 ${n > 0 ? 'text-teal-700' : row.level === 'M' ? 'text-red-400' : 'text-slate-400'}`} />
                          <p className="font-medium text-xs mt-1 pr-8">{fname(row.facility)}</p>
                          <p className="text-[10px] text-slate-400">{n > 0 ? `✓ 已添加 ${n} 处，再点继续` : row.facility === 'other' ? '自定义条款 · 现场录入' : row.condition ? `条件：${row.condition}` : `${row.items.length} 个检查点`}</p>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 实例卡片 */}
            {instances.map(ins => {
              const row = rowOf[ins.facility]
              if (!row) return null
              const open = expandedId === ins.id
              const fails = row.items.filter(it => ins.checks[it.key]?.verdict === 'fail').length
              const doneAll = isAnswered(ins)
              return (
                <Card key={ins.id} className={fails > 0 ? 'border-red-300' : ''}>
                  <div className="flex items-center gap-1 px-3 py-2.5">
                    <button type="button" className="flex-1 min-w-0 flex items-center gap-1.5 text-left" onClick={() => setExpandedId(open ? null : ins.id)}>
                      {ins.applicable === false ? <span className="text-[10px] text-slate-400 shrink-0 border rounded px-1">不涉及</span>
                        : !doneAll ? <span className="w-3.5 h-3.5 rounded-full border inline-block shrink-0" />
                        : fails > 0 ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        : <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                      <span className="font-medium text-sm truncate">{fname(ins.facility)} {String(ins.no).padStart(2, '0')}{ins.locationDesc ? ` · ${ins.locationDesc}` : ''}</span>
                      <span className={`text-[10px] shrink-0 ${LEVEL_META[row.level].tone}`}>{LEVEL_META[row.level].symbol}</span>
                      {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                    </button>
                    <button className="shrink-0 text-slate-300 hover:text-red-500 p-1" onClick={() => removeInstance(ins.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {open && (
                    <CardContent className="px-3 pb-3 pt-0 space-y-2.5 border-t">
                      <div className="pt-2.5 space-y-2">
                        <Input className="h-10" placeholder="设施位置描述（如：南门东侧、1号楼首层）" value={ins.locationDesc} onChange={e => updIns(ins.id, { locationDesc: e.target.value })} />
                        <PhotoPicker label="现场取证照片" photos={ins.photos ?? []} onChange={v => updIns(ins.id, { photos: v })} />
                        {/* 基本设置：本处不涉及该服务设施 → 无需逐项评测，且不生成问题 */}
                        <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer select-none border-t pt-2">
                          <input type="checkbox" className="accent-teal-700 mt-0.5"
                            checked={ins.applicable === false}
                            onChange={e => updIns(ins.id, { applicable: e.target.checked ? false : true })} />
                          <span>本处不涉及该服务设施<span className="text-slate-400">（勾选后无需评测，不生成问题单）</span></span>
                        </label>
                      </div>
                      {ins.applicable === false && (
                        <p className="text-[11px] text-slate-500 bg-slate-100 rounded-md p-2.5">已标记"本处不涉及该服务设施"：本实例无需逐项评测，提交后不作为缺失、不生成问题单。</p>
                      )}
                      {ins.applicable !== false && row.typeNote && (
                        <div className="border-l-4 border-teal-500 bg-teal-50/60 rounded-r-md p-2.5">
                          <p className="text-[11px] font-medium text-teal-800 mb-0.5">本类型配置要求（{row.typeClause}）</p>
                          <p className="text-xs leading-relaxed">{row.typeNote}</p>
                        </div>
                      )}
                      {ins.applicable !== false && row.items.map(item => (
                        <CheckItemCard key={item.key} item={item} res={ins.checks[item.key]}
                          onMeasure={v => {
                            const num = parseFloat(v)
                            updCheck(ins.id, item.key, { measured: v, verdict: isNaN(num) ? undefined : item.param && judgeParam(item.param, num) ? 'pass' : 'fail' })
                          }}
                          onVerdict={v => updCheck(ins.id, item.key, { verdict: v })} />
                      ))}

                      {/* 自定义条款（所有设施均可由督导员现场增补，条款内容自行录入） */}
                      {ins.applicable !== false && (
                        <>
                          {(ins.customItems ?? []).length === 0 && ins.facility === 'other' && (
                            <p className="text-[11px] text-slate-400 border border-dashed rounded-md p-2.5">该设施无预设检查点，请在下方自行添加条款（条款内容由您录入）。</p>
                          )}
                          {(ins.customItems ?? []).map(c => {
                            const res = ins.checks[c.key]
                            return (
                              <div key={c.key} className={`border rounded-md p-2.5 ${res?.verdict === 'fail' ? 'border-red-300 bg-red-50/40' : res?.verdict === 'pass' ? 'border-green-200 bg-green-50/30' : 'bg-white'}`}>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-xs">{c.aspect}</span>
                                  <Badge variant="outline" className="text-[9px] text-purple-700 border-purple-300 px-1">自定义条款</Badge>
                                  <span className="flex-1" />
                                  <button className="text-slate-300 hover:text-red-500 p-0.5" onClick={() => removeCustomItem(ins.id, c.key)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{c.requirement} <span className="text-slate-400">（督导员现场补充条款）</span></p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                  <Button size="sm" variant={res?.verdict === 'pass' ? 'default' : 'outline'}
                                    className={`h-9 text-xs ${res?.verdict === 'pass' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                    onClick={() => updCheck(ins.id, c.key, { verdict: 'pass' })}>满足要求</Button>
                                  <Button size="sm" variant={res?.verdict === 'fail' ? 'destructive' : 'outline'} className="h-9 text-xs"
                                    onClick={() => updCheck(ins.id, c.key, { verdict: 'fail' })}>不满足要求</Button>
                                </div>
                              </div>
                            )
                          })}
                          <div className="border border-dashed border-purple-300 rounded-md p-2.5 bg-purple-50/40 space-y-2">
                            <p className="text-[11px] font-medium text-purple-800">添加自定义条款<span className="font-normal text-slate-400">（现场增补；不合格按"建议改进"立案）</span></p>
                            <Input className="h-9" placeholder="条款名称（如：无障碍饮水设施）" value={newClause.aspect} onChange={e => setNewClause({ ...newClause, aspect: e.target.value })} />
                            <Textarea placeholder="条款内容 / 要求（自行录入判定依据）" value={newClause.requirement} onChange={e => setNewClause({ ...newClause, requirement: e.target.value })} />
                            <Button size="sm" variant="outline" className="h-8 text-xs w-full" onClick={() => addCustomItem(ins.id)}>
                              <Plus className="w-3.5 h-3.5 mr-1" />添加条款
                            </Button>
                          </div>
                        </>
                      )}
                      <Textarea placeholder="现场情况 / 备注" value={ins.note ?? ''} onChange={e => updIns(ins.id, { note: e.target.value })} />
                    </CardContent>
                  )}
                </Card>
              )
            })}
            {instances.length === 0 && !showPicker && (
              <p className="text-xs text-slate-400 text-center py-4">尚未添加设施实例，请展开上方"添加设施实例"选择现场实际设有的设施。</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-10" onClick={() => setStep(0)}><ChevronLeft className="w-4 h-4" />上一步</Button>
              <Button className="flex-1 h-10" onClick={() => setStep(2)}>
                {instances.length === 0 ? '现场无相关设施，直接进入汇总' : `完成核查，查看汇总（已核查 ${answered}/${instances.length}）`} <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}

        {/* ===== 第3步：汇总提交 ===== */}
        {step === 2 && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {([['设施实例', instances.length], ['已核查', answered], ['缺失', missing.length], ['不合格', failed.length]] as [string, number][]).map(([l, v]) => (
                <div key={l} className="border rounded-md p-2 text-center bg-white">
                  <p className="text-lg font-bold text-teal-800">{v}</p><p className="text-[10px] text-slate-500">{l}</p>
                </div>
              ))}
            </div>

            {missing.length > 0 && (
              <Card className="border-red-200">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-red-700">设施缺失：必须项（●）自动立案；条件项（○）需确认触发条件</p>
                  {missing.map(row => {
                    const triggered = condTriggered.includes(row.facility)
                    return (
                      <div key={row.facility} className="border-t pt-2 text-xs space-y-1.5">
                        <p className="font-medium flex items-center gap-1.5">
                          <AlertTriangle className={`w-3.5 h-3.5 ${row.level === 'M' || triggered ? 'text-red-500' : 'text-slate-300'}`} />
                          缺少{row.level === 'M' ? '必须设置的' : '条件设置的'}{fname(row.facility)}
                          <Badge variant="secondary" className="text-[10px]">{LEVEL_META[row.level].label}</Badge>
                        </p>
                        <p className="text-slate-500">{row.typeNote ?? row.items[0]?.requirement}（{row.typeClause ?? row.items[0]?.clause}）</p>
                        {row.level === 'M'
                          ? <p className="text-red-600">将自动生成问题单</p>
                          : (
                            <div className="space-y-1.5">
                              <p className="text-slate-400">触发条件{row.condition ? `（${row.condition}）` : ''}是否满足？</p>
                              <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" variant={triggered ? 'destructive' : 'outline'} className="h-8 text-xs"
                                  onClick={() => toggleCond(row.facility, true)}>条件触发·确属缺失</Button>
                                <Button size="sm" variant={triggered ? 'outline' : 'secondary'} className="h-8 text-xs"
                                  onClick={() => toggleCond(row.facility, false)}>条件不触发·不立案</Button>
                              </div>
                            </div>
                          )}
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            )}

            {failed.length > 0 && (
              <Card className="border-red-200">
                <CardContent className="p-3 space-y-2">
                  <p className="text-xs font-semibold text-red-700">不合格检查点（提交后自动生成问题单）</p>
                  {failed.map(({ ins, item }, i) => (
                    <div key={i} className="border-t pt-2 text-xs">
                      <p className="font-medium flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                        {fname(ins.facility)} · {item.aspect} · 实例{String(ins.no).padStart(2, '0')}{ins.locationDesc ? `（${ins.locationDesc}）` : ''}
                      </p>
                      <p className="text-slate-500 mt-0.5">{item.requirement}（{item.clause}）{ins.checks[item.key]?.measured ? `｜实测：${ins.checks[item.key]!.measured}` : ''}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {missing.length === 0 && failed.length === 0 && answered === instances.length && (
              <p className="text-sm text-green-700 bg-green-50 rounded-md p-3">✓ 全部检查点符合要求，无缺失设施，提交后点位标记为"已销号/合格"。</p>
            )}
            {missing.length > 0 && missingIssues.length === 0 && failed.length === 0 && (
              <p className="text-sm text-green-700 bg-green-50 rounded-md p-3">✓ 缺失项均为条件设置项且触发条件未满足，不生成问题单。</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-10" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4" />返回核查</Button>
              {submitted
                ? <Badge className="flex-1 bg-green-600 text-white justify-center py-2">✓ 已提交归档</Badge>
                : <Button className="flex-1 h-10" onClick={() => void submit()} disabled={answered < instances.length || submitInspection.isPending}>
                    提交检查{answered < instances.length ? `（剩 ${instances.length - answered} 个未核查）` : ''}
                  </Button>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** 单个检查点卡片：实测输入（数值自动判定）+ 大按钮人工判定 */
function CheckItemCard({
  item,
  res,
  onMeasure,
  onVerdict,
}: {
  item: CheckItem
  res?: { measured?: string; verdict?: 'pass' | 'fail' }
  onMeasure: (v: string) => void
  onVerdict: (v: 'pass' | 'fail') => void
}) {
  return (
    <div className={`border rounded-md p-2.5 ${res?.verdict === 'fail' ? 'border-red-300 bg-red-50/40' : res?.verdict === 'pass' ? 'border-green-200 bg-green-50/30' : 'bg-white'}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium text-xs">{item.aspect}</span>
        {item.param && <Badge variant="outline" className="text-[9px] text-teal-700 border-teal-300 px-1">数值自动判定</Badge>}
        {item.condition && <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 px-1">条件：{item.condition}</Badge>}
      </div>
      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{item.requirement} <span className="text-slate-400">（{item.clause}）</span></p>
      {item.param && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <Input className="w-32 h-9" type="number" step="any" inputMode="decimal" placeholder={`实测值（${item.param.unit}）`}
              value={res?.measured ?? ''} onChange={e => onMeasure(e.target.value)} />
            <span className="text-[10px] text-slate-400">阈值：{item.param.kind === 'min' ? '≥' + item.param.min : item.param.kind === 'max' ? '≤' + item.param.max : `${item.param.min}–${item.param.max}`}{item.param.unit}</span>
          </div>
          {res?.measured != null && res.measured !== '' && !isNaN(parseFloat(res.measured)) && (
            res.verdict === 'pass'
              ? <span className="text-[11px] text-green-600 font-medium">✓ 自动判定：满足要求</span>
              : <span className="text-[11px] text-red-600 font-medium">× 自动判定：不满足要求</span>
          )}
          {item.param.hint && <p className="text-[10px] text-slate-400">{item.param.hint}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <Button size="sm" variant={res?.verdict === 'pass' ? 'default' : 'outline'}
          className={`h-9 text-xs ${res?.verdict === 'pass' ? 'bg-green-600 hover:bg-green-700' : ''}`}
          onClick={() => onVerdict('pass')}>满足要求</Button>
        <Button size="sm" variant={res?.verdict === 'fail' ? 'destructive' : 'outline'} className="h-9 text-xs"
          onClick={() => onVerdict('fail')}>不满足要求</Button>
      </div>
    </div>
  )
}
