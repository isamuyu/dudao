import { useMemo, useRef, useState } from 'react'
import { useStore, useCurrent, uid, distM, type InstanceResult, type Issue } from '@/store/app'
import { buildFacilityRows, facilityName, LEVEL_META, judgeParam, SUBTYPE_MAP, type CheckItem, type FacilityRow } from '@/data/checklib'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, Armchair, ArrowUpDown, ArrowUpNarrowWide, Accessibility, Bath, BedDouble, BellRing, Camera, Car, CheckCircle2, ChevronLeft, ChevronRight, Compass, DoorClosed, DoorOpen, Download, FileText, Lock, MapPin, Minus, Plus, Printer, Route, SeparatorHorizontal, ShowerHead, Signpost, Table, Toilet, TrendingUp, Waypoints, XCircle, type LucideIcon } from 'lucide-react'

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
}
const LEVEL_BADGE: Record<string, { text: string; cls: string }> = {
  M: { text: '● 必须', cls: 'bg-red-600 text-white' },
  C: { text: '○ 条件', cls: 'bg-amber-500 text-white' },
  R: { text: '△ 推荐', cls: 'bg-sky-500 text-white' },
}

const COLLECT_STATUS = [
  { id: 'ok', label: '允许采集' },
  { id: 'no_enter', label: '无法采集-不允许进入' },
  { id: 'closed', label: '无法采集-关闭' },
  { id: 'construct', label: '无法采集-施工' },
  { id: 'occupied', label: '无法采集-被占用' },
  { id: 'missing', label: '无法采集-不存在' },
  { id: 'damaged', label: '无法采集-损坏' },
]
const STEPS = ['建筑主体信息', '设施实例', '逐项核查', '汇总提交']
const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

function PhotoPicker({ label, photos, onChange }: { label: string; photos: string[]; onChange: (v: string[]) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => ref.current?.click()}>
          <Camera className="w-3 h-3 mr-1" />拍照/上传
        </Button>
        <input ref={ref} type="file" accept="image/*" multiple className="hidden"
          onChange={e => { const names = Array.from(e.target.files ?? []).map(f => f.name); if (names.length) onChange([...photos, ...names]); e.target.value = '' }} />
      </div>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {photos.map((p, i) => (
            <span key={i} className="text-[11px] bg-slate-100 rounded px-1.5 py-0.5 flex items-center gap-1">
              {p}<button onClick={() => onChange(photos.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface FailedEntry { ins: InstanceResult; item: CheckItem }
interface MissingEntry { row: FacilityRow }

export default function InspectPage() {
  const { state, dispatch } = useStore()
  const { user } = useCurrent()
  const task = state.tasks.find(t => t.id === state.activeTaskId)!
  const point = state.points.find(p => p.id === task.pointId)!
  const subtype = SUBTYPE_MAP[point.subtypeId]
  const facilityRows = useMemo(() => buildFacilityRows(point.subtypeId), [point.subtypeId])
  const rowOf = useMemo(() => Object.fromEntries(facilityRows.map(r => [r.facility, r])), [facilityRows])

  const [step, setStep] = useState(0)
  const [main, setMain] = useState({ floors: '', nature: point.nature, contact: '', contactPhone: point.contact, collectStatus: 'ok', note: '', doorFace: [] as string[], panoOut: [] as string[], panoIn: [] as string[] })
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [instances, setInstances] = useState<InstanceResult[]>([])
  const [cur, setCur] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  /** 第2步：数量 → 实例清单 */
  const regen = (nc: Record<string, number>) => {
    setCounts(nc)
    setInstances(prev => {
      const next: InstanceResult[] = []
      Object.entries(nc).forEach(([fac, n]) => {
        const exist = prev.filter(x => x.facility === fac)
        for (let i = 0; i < n; i++) next.push(exist[i] ?? { id: uid('ins'), facility: fac, no: i + 1, locationDesc: '', checks: {}, photos: [] })
      })
      return next
    })
  }
  const updIns = (id: string, patch: Partial<InstanceResult>) =>
    setInstances(prev => prev.map(x => x.id === id ? { ...x, ...patch } : x))
  const updCheck = (id: string, key: string, patch: { measured?: string; verdict?: 'pass' | 'fail' }) =>
    setInstances(prev => prev.map(x => x.id === id ? { ...x, checks: { ...x.checks, [key]: { ...x.checks[key], ...patch } } } : x))

  const blocked = main.collectStatus !== 'ok'

  /** 缺失项：现场数量为 0 的必须/条件设施 */
  const missing: MissingEntry[] = facilityRows
    .filter(r => (counts[r.facility] ?? 0) === 0 && r.level !== 'R')
    .map(row => ({ row }))

  const isAnswered = (x: InstanceResult) => {
    if (x.applicable === false) return true
    if (x.applicable !== true) return false
    const row = rowOf[x.facility]
    return !!row && row.items.every(it => x.checks[it.key]?.verdict != null)
  }
  const answered = instances.filter(isAnswered).length

  const failed: FailedEntry[] = instances.flatMap(ins => {
    const row = rowOf[ins.facility]
    if (!row || ins.applicable !== true) return []
    return row.items.filter(it => ins.checks[it.key]?.verdict === 'fail').map(item => ({ ins, item }))
  })

  const submit = () => {
    const now = new Date().toLocaleString('zh-CN', { hour12: false })
    const by = user.name.replace(/（.*）/, '')
    const newIssues: Issue[] = []
    if (!blocked) {
      // ① 缺失 → 问题单：必须项全部立案；条件项未核实触发条件不立案（与正式版 V1.2 规则一致）
      missing.filter(({ row }) => row.level === 'M').forEach(({ row }) => {
        newIssues.push({
          id: uid('i'), orgId: point.orgId, pointId: point.id, facility: row.facility,
          title: `缺少${row.level === 'M' ? '必须设置的' : '条件设置的'}${facilityName(row.facility)}`,
          requirement: row.typeNote ?? row.items[0]?.requirement ?? '',
          clause: row.typeClause ?? row.items[0]?.clause ?? '',
          severity: row.level === 'M' ? 'M' : 'C',
          desc: row.level === 'M'
            ? `按配置矩阵该建筑类型必须设置${facilityName(row.facility)}，现场未发现该设施。`
            : `${facilityName(row.facility)}为条件设置项，现场未设置，需核实触发条件（${row.condition ?? '详见标准'}）。`,
          status: 'open',
          history: [{ at: now, action: '现场检查发现（设施缺失），自动生成问题单', by }],
        })
      })
      // ② 设施检查点不符合 → 问题单
      failed.forEach(({ ins, item }) => {
        newIssues.push({
          id: uid('i'), orgId: point.orgId, pointId: point.id, facility: ins.facility,
          title: `${facilityName(ins.facility)}·${item.aspect}不符合（${ins.locationDesc || `实例${ins.no}`}）`,
          requirement: item.requirement, clause: item.clause,
          severity: item.level,
          desc: [ins.checks[item.key]?.measured ? `实测：${ins.checks[item.key]!.measured}` : '', ins.note || ''].filter(Boolean).join('；') || '现场核查不符合标准要求',
          status: 'open',
          history: [{ at: now, action: '现场检查发现，自动生成问题单', by }],
        })
      })
    }
    dispatch({
      type: 'SUBMIT_INSPECTION',
      inspection: { id: uid('r'), orgId: point.orgId, taskId: task.id, pointId: point.id, mainInfo: main, instances, submittedAt: now },
      newIssues,
      pointStatus: blocked ? 'blocked' : newIssues.length > 0 ? 'issue' : 'closed',
    })
    setSubmitted(true)
  }

  /** ===== 导出 ===== */
  const aspectRows = () => instances.flatMap(ins => {
    const row = rowOf[ins.facility]
    if (!row) return []
    return row.items.map(item => ({ ins, item, res: ins.checks[item.key] }))
  })
  const exportJSON = () => {
    const data = { point: { name: point.name, address: point.address, subtype: subtype?.name, lat: point.lat, lng: point.lng }, mainInfo: main, instances, missingFacilities: missing.map(m => facilityName(m.row.facility)), exportedAt: new Date().toISOString() }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = `${point.name}-核验数据.json`; a.click()
  }
  const exportCSV = () => {
    const rows = [['设施类别', '实例编号', '位置描述', '检查点', '配置等级', '标准要求', '条款依据', '实测值', '适用', '结论', '备注']]
    missing.forEach(({ row }) => rows.push([facilityName(row.facility), '-', '-', '（整项缺失）', LEVEL_META[row.level].label, row.typeNote ?? row.items[0]?.requirement ?? '', row.typeClause ?? '', '', '-', row.level === 'M' ? '不符合-必须项缺失' : '待核实-条件项未设置', '']))
    aspectRows().forEach(({ ins, item, res }) => {
      rows.push([facilityName(ins.facility), String(ins.no), ins.locationDesc, item.aspect, LEVEL_META[item.level].label, item.requirement, item.clause, res?.measured ?? '', ins.applicable === false ? '不适用' : '适用', ins.applicable === false ? '—' : res?.verdict === 'pass' ? '符合' : res?.verdict === 'fail' ? '不符合' : '未核查', ins.note ?? ''])
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
      return `<tr><td>${facilityName(ins.facility)}</td><td>${ins.no}</td><td>${ins.locationDesc}</td><td>${item.aspect}</td><td style="font-size:11px">${item.requirement}</td><td>${item.clause}</td><td>${res?.measured ?? ''}</td><td>${r}</td></tr>`
    }).join('')
    const missingRows = missing.map(({ row }) => `<tr style="background:#fee2e2"><td>${facilityName(row.facility)}</td><td>-</td><td>-</td><td>整项缺失</td><td style="font-size:11px">${row.typeNote ?? row.items[0]?.requirement ?? ''}</td><td>${row.typeClause ?? ''}</td><td></td><td>✗ ${row.level === 'M' ? '必须项缺失' : '条件项未设置'}</td></tr>`).join('')
    w.document.write(`<html><head><meta charset="utf-8"><title>无障碍设施核验结果表</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;font-size:12px}h1{font-size:18px}</style></head><body>
      <h1>无障碍设施核验结果表</h1>
      <p>点位：${point.name}（${subtype?.name}）　地址：${point.address}　GPS：${point.lat}, ${point.lng}　检查人：${user.name}　时间：${new Date().toLocaleString('zh-CN')}</p>
      <p>设施实例 ${instances.length}　已核查 ${answered}　缺失设施 ${missing.length}　不合格检查点 ${failed.length}</p>
      <table><tr><th>设施类别</th><th>编号</th><th>位置</th><th>检查点</th><th>标准要求</th><th>条款</th><th>实测</th><th>结论</th></tr>${missingRows}${rows}</table>
      <script>window.print()</script></body></html>`)
    w.document.close()
  }

  const curIns = instances[cur]
  const curRow = curIns ? rowOf[curIns.facility] : undefined

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
          <Button variant="outline" size="sm" onClick={() => dispatch({ type: 'SET_TASK_STATUS', taskId: task.id, status: 'todo' })}>
            <ChevronLeft className="w-4 h-4" />暂存退出
          </Button>
        </div>

        {/* 步骤条 */}
        <div className="flex gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className={`flex-1 rounded-md px-3 py-2 text-xs font-medium ${i === step ? 'bg-teal-700 text-white' : i < step ? 'bg-teal-100 text-teal-800' : 'bg-white text-slate-400 border'}`}>
              第{i + 1}步 · {s}
            </div>
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
              <label className="space-y-1 block"><span className="text-xs text-slate-500">采集状态 *</span>
                <select className={selCls + ' w-full'} value={main.collectStatus} onChange={e => setMain({ ...main, collectStatus: e.target.value })}>
                  {COLLECT_STATUS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select></label>
              {blocked && <p className="text-xs text-purple-700 bg-purple-50 rounded p-2">已选择无法采集：提交后任务按"无法采集"结办，点位保留待下次督导。请在备注与照片中说明原因。</p>}
              <div className="grid grid-cols-3 gap-3 border rounded-md p-3 bg-slate-50/50">
                <PhotoPicker label="门脸图 *" photos={main.doorFace} onChange={v => setMain({ ...main, doorFace: v })} />
                <PhotoPicker label="全景图（外）" photos={main.panoOut} onChange={v => setMain({ ...main, panoOut: v })} />
                <PhotoPicker label="全景图（内）" photos={main.panoIn} onChange={v => setMain({ ...main, panoIn: v })} />
              </div>
              <Textarea placeholder="现场情况备注" value={main.note} onChange={e => setMain({ ...main, note: e.target.value })} />
              <div className="flex justify-end">
                {blocked
                  ? <Button variant="destructive" onClick={submit}>按"无法采集"提交结办</Button>
                  : <Button onClick={() => setStep(1)}>下一步：选择现场设施 <ChevronRight className="w-4 h-4" /></Button>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 第2步：设施实例（图标卡片式选择） */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">选择该场地实际设有的无障碍设施
                <span className="block text-xs font-normal text-slate-500 mt-1">按"建筑类型 × 配置矩阵"列出应配设施；点击卡片标记现场设有该项，同类设施有多处时用 + 增加实例分别检查。<b className="text-red-600">必须项未选择将在提交时作为"设施缺失"问题单列案。</b></span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                {facilityRows.map(row => {
                  const n = counts[row.facility] ?? 0
                  const selected = n > 0
                  const Icon = FACILITY_ICONS[row.facility] ?? Accessibility
                  const lb = LEVEL_BADGE[row.level]
                  return (
                    <div key={row.facility}
                      onClick={() => regen({ ...counts, [row.facility]: selected ? 0 : 1 })}
                      className={`relative cursor-pointer rounded-lg border-2 p-3 transition-colors select-none ${
                        selected ? 'border-teal-600 bg-teal-50/60'
                        : row.level === 'M' ? 'border-red-300 border-dashed bg-red-50/30 hover:border-red-400'
                        : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <span className={`absolute top-2 right-2 text-[10px] font-semibold rounded px-1.5 py-0.5 ${lb.cls}`}>{lb.text}</span>
                      <Icon className={`w-7 h-7 ${selected ? 'text-teal-700' : row.level === 'M' ? 'text-red-400' : 'text-slate-400'}`} />
                      <p className="font-medium text-sm mt-1.5 pr-10">{facilityName(row.facility)}</p>
                      <p className="text-[11px] text-slate-400">{row.items.length} 个检查点{row.condition ? ` · 条件：${row.condition}` : ''}</p>
                      {row.typeNote && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2" title={row.typeNote}>{row.typeNote}</p>}
                      <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={n === 0}
                          onClick={() => regen({ ...counts, [row.facility]: Math.max(0, n - 1) })}><Minus className="w-3.5 h-3.5" /></Button>
                        <span className={`text-sm font-semibold w-6 text-center ${selected ? 'text-teal-800' : 'text-slate-400'}`}>{n}</span>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0"
                          onClick={() => regen({ ...counts, [row.facility]: n + 1 })}><Plus className="w-3.5 h-3.5" /></Button>
                        {selected && <span className="text-[11px] text-teal-700 ml-1">✓ 已选 {n} 处</span>}
                        {!selected && row.level === 'M' && <span className="text-[11px] text-red-500 ml-1 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />缺失将列问题</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500">
                已选 {facilityRows.filter(r => (counts[r.facility] ?? 0) > 0).length} 类设施、共 {instances.length} 个实例；
                未选的必须项 {facilityRows.filter(r => (counts[r.facility] ?? 0) === 0 && r.level === 'M').length} 项、条件项 {facilityRows.filter(r => (counts[r.facility] ?? 0) === 0 && r.level === 'C').length} 项。
              </p>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(0)}><ChevronLeft className="w-4 h-4" />上一步</Button>
                {instances.length > 0
                  ? <Button onClick={() => { setCur(0); setStep(2) }}>下一步：逐项核查 <ChevronRight className="w-4 h-4" /></Button>
                  : <Button variant="secondary" onClick={() => setStep(3)}>现场无相关设施，直接进入汇总 <ChevronRight className="w-4 h-4" /></Button>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 第3步：逐项核查 */}
        {step === 2 && curIns && curRow && (
          <div className="grid grid-cols-[240px_1fr] gap-4">
            {/* 实例目录 */}
            <Card className="h-fit">
              <CardHeader className="py-3"><CardTitle className="text-sm">实例目录（{answered}/{instances.length}）</CardTitle></CardHeader>
              <CardContent className="p-2 space-y-1 max-h-[420px] overflow-auto">
                {instances.map((x, i) => {
                  const row = rowOf[x.facility]
                  const fails = row ? row.items.filter(it => x.checks[it.key]?.verdict === 'fail').length : 0
                  return (
                    <button key={x.id} onClick={() => setCur(i)}
                      className={`w-full text-left text-xs rounded px-2 py-1.5 flex items-center gap-1.5 ${i === cur ? 'bg-teal-700 text-white' : 'hover:bg-slate-100'}`}>
                      {x.applicable === false ? '—' : !isAnswered(x) ? <span className="w-3.5 h-3.5 rounded-full border inline-block shrink-0" /> : fails > 0 ? <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                      <span className="truncate">{facilityName(x.facility)} {String(x.no).padStart(2, '0')}{x.locationDesc ? ` · ${x.locationDesc}` : ''}</span>
                    </button>
                  )
                })}
              </CardContent>
            </Card>

            {/* 核查表单 */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className={`font-bold ${LEVEL_META[curRow.level].tone}`}>{LEVEL_META[curRow.level].symbol}</span>
                  {facilityName(curIns.facility)} · 实例 {String(curIns.no).padStart(2, '0')}
                  <Badge variant="secondary" className="text-[11px]">{LEVEL_META[curRow.level].label}</Badge>
                  <span className="text-xs font-normal text-slate-400">{curRow.items.length} 个检查点</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <label className="space-y-1 block"><span className="text-xs text-slate-500">设施位置描述（如：南门东侧、1号楼首层）</span>
                  <Input value={curIns.locationDesc} onChange={e => updIns(curIns.id, { locationDesc: e.target.value })} /></label>

                {curRow.typeNote && (
                  <div className="border-l-4 border-teal-500 bg-teal-50/60 rounded-r-md p-3">
                    <p className="text-xs font-medium text-teal-800 mb-0.5">本建筑类型配置要求（{curRow.typeClause}）</p>
                    <p className="text-sm leading-relaxed">{curRow.typeNote}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-slate-600 mb-1">适用性判断</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant={curIns.applicable === true ? 'default' : 'outline'} onClick={() => updIns(curIns.id, { applicable: true })}>是，继续核验</Button>
                    <Button size="sm" variant={curIns.applicable === false ? 'secondary' : 'outline'} onClick={() => updIns(curIns.id, { applicable: false })}>否，本项不适用</Button>
                  </div>
                </div>

                {curIns.applicable && (
                  <div className="space-y-2">
                    {curRow.items.map(item => {
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
                    <PhotoPicker label="取证照片（自动附加时间/GPS/点位水印，原型以文件名示意）" photos={curIns.photos ?? []} onChange={v => updIns(curIns.id, { photos: v })} />
                    <Textarea placeholder="现场情况 / 整改说明 / 备注" value={curIns.note ?? ''} onChange={e => updIns(curIns.id, { note: e.target.value })} />
                  </div>
                )}

                <div className="flex justify-between pt-1">
                  <Button variant="outline" size="sm" disabled={cur === 0} onClick={() => setCur(cur - 1)}><ChevronLeft className="w-4 h-4" />上一项</Button>
                  {cur < instances.length - 1
                    ? <Button size="sm" onClick={() => setCur(cur + 1)}>下一项 <ChevronRight className="w-4 h-4" /></Button>
                    : <Button size="sm" onClick={() => setStep(3)}>完成核查，查看汇总 <ChevronRight className="w-4 h-4" /></Button>}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 第4步：汇总提交 */}
        {step === 3 && (
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
                  <p className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 rounded-t-md">设施缺失（提交后自动生成问题单）</p>
                  {missing.map(({ row }) => (
                    <div key={row.facility} className="px-3 py-2 border-t text-xs flex gap-2 items-start">
                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">缺少{row.level === 'M' ? '必须设置的' : '条件设置的'}{facilityName(row.facility)}
                          <Badge variant="secondary" className="ml-1 text-[10px]">{LEVEL_META[row.level].label}</Badge></p>
                        <p className="text-slate-500 mt-0.5">{row.typeNote ?? row.items[0]?.requirement}（{row.typeClause ?? row.items[0]?.clause}）</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {failed.length > 0 && (
                <div className="border border-red-200 rounded-md">
                  <p className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 rounded-t-md">不合格检查点明细（提交后自动生成问题单）</p>
                  {failed.map(({ ins, item }, i) => (
                    <div key={i} className="px-3 py-2 border-t text-xs flex gap-2 items-start">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">{facilityName(ins.facility)} · {item.aspect} · 实例{String(ins.no).padStart(2, '0')}{ins.locationDesc ? `（${ins.locationDesc}）` : ''}
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

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportJSON}><Download className="w-4 h-4 mr-1" />导出 JSON</Button>
                <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1" />导出 CSV</Button>
                <Button variant="outline" size="sm" onClick={printReport}><Printer className="w-4 h-4 mr-1" />打印 / PDF</Button>
              </div>
              <div className="flex justify-between border-t pt-3">
                <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4" />返回核查</Button>
                {submitted
                  ? <Badge className="bg-green-600 text-white px-4 py-2">✓ 已提交：检查记录已归档，问题单已生成</Badge>
                  : <Button onClick={submit} disabled={answered < instances.length}>提交检查{answered < instances.length ? `（剩余 ${instances.length - answered} 个实例未核查）` : ''}</Button>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
