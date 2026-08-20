import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Rectangle, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { toast } from 'sonner'
import { TDT_VEC, TDT_CVA, TDT_SUBDOMAINS } from '@/config'
import { inRegion, inBounds, distM, POINT_STATUS_META } from '@/store/app'
import { useAuth } from '@/auth/AuthContext'
import { useCampaigns, useCreateCampaign, useCreatePoint, useIssues, usePoints } from '@/api/hooks'
import { reverseGeocode, searchNearby, type NearbyPoi } from '@/api/geocode'
import { BUILDING_GROUPS, BUILDING_SUBTYPES, SUBTYPE_MAP, MATRIX, FACILITIES, LEVEL_META } from '@/data/checklib'
import { Pager, usePager } from '@/components/Pager'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Building2, Flag, Loader2, Lock, MapPin, Plus, Route, Search } from 'lucide-react'

type Mode = null | 'region' | 'building' | 'road'
type LatLng = [number, number]

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm w-full'
const chipCls = 'bg-teal-50 border border-teal-200 text-teal-800 rounded px-1.5 py-0.5 hover:bg-teal-100 cursor-pointer'

export default function MapPage() {
  const { org, user } = useAuth()
  const { data: campaigns = [] } = useCampaigns()
  const { data: points = [] } = usePoints()
  const { data: issues = [] } = useIssues()
  const createCampaign = useCreateCampaign()
  const createPoint = useCreatePoint()

  const [selRaw, setSelCampaign] = useState<string | null>(null)
  const selCampaign = campaigns.some(c => c.id === selRaw) ? selRaw : (campaigns[0]?.id ?? null)

  const campaign = campaigns.find(c => c.id === selCampaign) ?? null
  const objects = useMemo(() => points.filter(p => p.campaignId === selCampaign), [points, selCampaign])
  const objectsPg = usePager(objects, 8, selCampaign)   // 侧栏列表分页；地图标记始终全量展示
  const issueCount = (pointId: string) => issues.filter(i => i.pointId === pointId && i.status !== 'closed' && i.status !== 'deferred').length

  const [mode, setMode] = useState<Mode>(null)
  const [corners, setCorners] = useState<LatLng[]>([])      // 行动区域两角
  const [roadPts, setRoadPts] = useState<LatLng[]>([])      // 道路起终点
  const [picked, setPicked] = useState<LatLng | null>(null) // 建筑点位
  const [cForm, setCForm] = useState({ name: '', regionDesc: '' })
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const defaultDeadline = () => new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  const [bForm, setBForm] = useState({ name: '', address: '', group: 'office', subtype: 'gov', nature: '既有', owner: '', contact: '', publish: true, deadline: defaultDeadline() })
  const [rForm, setRForm] = useState({ name: '', address: '', owner: '', contact: '', publish: true, deadline: defaultDeadline() })
  const [err, setErr] = useState('')

  /** 打点后自动识别附近地址（逆地理 + 附近搜索） */
  const [geo, setGeo] = useState<{ loading: boolean; poi: string; address: string; kw: string; searching: boolean; results: NearbyPoi[] }>
    ({ loading: false, poi: '', address: '', kw: '', searching: false, results: [] })

  const identify = async (lat: number, lng: number) => {
    setGeo({ loading: true, poi: '', address: '', kw: '', searching: false, results: [] })
    const r = await reverseGeocode(lat, lng)
    setGeo(g => ({ ...g, loading: false, poi: r?.poi ?? '', address: r?.address || r?.formatted || '' }))
    // 地址为空时自动填入识别结果
    if (r && (r.address || r.formatted)) {
      const addr = r.address || r.formatted
      setBForm(f => f.address ? f : { ...f, address: addr })
      setRForm(f => f.address ? f : { ...f, address: addr })
    }
  }
  const doSearch = async (lat: number, lng: number) => {
    if (!geo.kw.trim()) return
    setGeo(g => ({ ...g, searching: true, results: [] }))
    const results = await searchNearby(lat, lng, geo.kw)
    setGeo(g => ({ ...g, searching: false, results }))
    if (results.length === 0) toast.info('附近未搜到相关地名，可换个关键词试试')
  }

  function resetModes() {
    setMode(null); setCorners([]); setRoadPts([]); setPicked(null); setErr(''); setCreatingCampaign(false)
    setGeo({ loading: false, poi: '', address: '', kw: '', searching: false, results: [] })
  }

  const onPick = (lat: number, lng: number) => {
    setErr('')
    if (mode === 'region') {
      setCorners(prev => prev.length >= 2 ? [ [lat, lng] ] : [...prev, [lat, lng]])
    } else if (mode === 'building') { setPicked([lat, lng]); void identify(lat, lng) }
    else if (mode === 'road') setRoadPts(prev => {
      const next = prev.length >= 2 ? [[lat, lng]] : [...prev, [lat, lng]]
      if (next.length === 2) void identify((next[0][0] + next[1][0]) / 2, (next[0][1] + next[1][1]) / 2)   // 识别路段中点地址
      return next as LatLng[]
    })
  }

  const toBounds = (cs: LatLng[]): [[number, number], [number, number]] => [
    [Math.min(cs[0][0], cs[1][0]), Math.min(cs[0][1], cs[1][1])],
    [Math.max(cs[0][0], cs[1][0]), Math.max(cs[0][1], cs[1][1])],
  ]

  const saveCampaign = async () => {
    if (!cForm.name.trim()) { setErr('请填写行动名称'); return }
    try {
      await createCampaign.mutateAsync({
        name: cForm.name.trim(),
        regionDesc: cForm.regionDesc,
        ...(corners.length === 2 && { bounds: toBounds(corners) }),   // 大致范围可选
      })
      toast.success('督导行动已创建')
      resetModes()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建行动失败')
    }
  }

  /** 硬性校验：仅组织督导区域限制（服务端同样强制） */
  const outOfOrg = (lat: number, lng: number): string | null =>
    org && !inRegion(org, lat, lng) ? `超出本组织督导区域（${org.regionName}），无法保存` : null
  /** 软性提醒：超出行动划定范围只提示，可继续 */
  const confirmOutOfCampaign = (lat: number, lng: number): boolean =>
    !campaign?.bounds || inBounds(campaign.bounds, lat, lng) ||
    confirm('该点位超出本行动划定的大致范围，仍要保存吗？')

  const saveBuilding = async () => {
    if (!picked) { setErr('请先在地图上点击选择建筑位置'); return }
    if (!bForm.name.trim()) { setErr('请填写建筑名称'); return }
    if (!bForm.owner.trim()) { setErr('请填写责任单位'); return }
    if (!bForm.contact.trim()) { setErr('请填写联系电话'); return }
    const e = outOfOrg(picked[0], picked[1]); if (e) { setErr(e); return }
    if (!confirmOutOfCampaign(picked[0], picked[1])) return
    try {
      await createPoint.mutateAsync({
        campaignId: selCampaign!, kind: 'building', name: bForm.name.trim(), address: bForm.address,
        lat: +picked[0].toFixed(6), lng: +picked[1].toFixed(6),
        subtypeId: bForm.subtype, nature: bForm.nature, owner: bForm.owner, contact: bForm.contact,
        publishTask: bForm.publish, ...(bForm.publish && { taskDeadline: bForm.deadline }),
      })
      toast.success(bForm.publish ? '建筑点位已保存，督导任务已发布到任务池' : '建筑点位已保存并锁定')
      setMode(null); setPicked(null); setBForm({ ...bForm, name: '', address: '' }); setErr('')
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : '保存点位失败')
    }
  }

  const saveRoad = async () => {
    if (roadPts.length !== 2) { setErr('请在地图上依次点击道路的起点和终点'); return }
    if (!rForm.name.trim()) { setErr('请填写道路/路段名称'); return }
    if (!rForm.owner.trim()) { setErr('请填写责任单位'); return }
    if (!rForm.contact.trim()) { setErr('请填写联系电话'); return }
    const e = outOfOrg(roadPts[0][0], roadPts[0][1]) ?? outOfOrg(roadPts[1][0], roadPts[1][1]); if (e) { setErr(e); return }
    if (!confirmOutOfCampaign(roadPts[0][0], roadPts[0][1]) || !confirmOutOfCampaign(roadPts[1][0], roadPts[1][1])) return
    try {
      await createPoint.mutateAsync({
        campaignId: selCampaign!, kind: 'road', name: rForm.name.trim(), address: rForm.address,
        lat: +roadPts[0][0].toFixed(6), lng: +roadPts[0][1].toFixed(6),
        lat2: +roadPts[1][0].toFixed(6), lng2: +roadPts[1][1].toFixed(6),
        subtypeId: 'road', nature: '既有', owner: rForm.owner, contact: rForm.contact,
        publishTask: rForm.publish, ...(rForm.publish && { taskDeadline: rForm.deadline }),
      })
      toast.success(rForm.publish ? '道路线段已保存，督导任务已发布到任务池' : '道路线段已保存并锁定')
      setMode(null); setRoadPts([]); setRForm({ name: '', address: '', owner: '', contact: '', publish: true, deadline: defaultDeadline() }); setErr('')
    } catch (e2) {
      toast.error(e2 instanceof Error ? e2.message : '保存点位失败')
    }
  }

  if (!org) {
    return <div className="h-full flex items-center justify-center text-sm text-slate-400">平台级账号无督导区域，请在"平台管理"中维护组织。</div>
  }

  const subtypes = BUILDING_SUBTYPES.filter(s => s.group === bForm.group)
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex h-full">
      {/* 左侧面板 */}
      <div className="w-[400px] shrink-0 border-r flex flex-col bg-white">
        {/* 行动列表 */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm flex items-center gap-1"><Flag className="w-4 h-4 text-teal-700" /> 督导行动</h2>
            {isAdmin && (
              <Button size="sm" variant={creatingCampaign ? 'secondary' : 'default'} className="h-7 text-xs"
                onClick={() => { resetModes(); setCreatingCampaign(!creatingCampaign) }}>
                <Plus className="w-3.5 h-3.5 mr-0.5" />{creatingCampaign ? '取消' : '发起行动'}
              </Button>
            )}
          </div>

          {creatingCampaign && (
            <div className="mb-2 p-2.5 rounded-md bg-teal-50/70 border border-teal-200 space-y-2 text-sm">
              <Input placeholder="行动名称 *（如：XX片区秋季无障碍督导行动）" value={cForm.name} onChange={e => setCForm({ ...cForm, name: e.target.value })} />
              <Input placeholder="区域描述（如：文二路—曙光路片区）" value={cForm.regionDesc} onChange={e => setCForm({ ...cForm, regionDesc: e.target.value })} />
              <Button size="sm" variant={mode === 'region' ? 'default' : 'outline'} className="w-full h-8 text-xs"
                onClick={() => { setMode(mode === 'region' ? null : 'region'); setCorners([]) }}>
                <MapPin className="w-3.5 h-3.5 mr-1" />
                {corners.length === 2 ? `区域已框选（${corners.length}/2 角点）` : mode === 'region' ? `请在地图点击第 ${corners.length + 1} 个角点…` : '框选行动大致区域（可选，地图两角点）'}
              </Button>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <Button size="sm" className="w-full h-8" disabled={createCampaign.isPending} onClick={() => void saveCampaign()}>创建行动</Button>
            </div>
          )}

          <div className="space-y-1.5 max-h-44 overflow-auto">
            {campaigns.map(c => {
              const objs = points.filter(p => p.campaignId === c.id)
              const open = objs.reduce((n, p) => n + issueCount(p.id), 0)
              return (
                <button key={c.id} onClick={() => { setSelCampaign(c.id); resetModes() }}
                  className={`w-full text-left rounded-md border px-2.5 py-2 text-xs ${selCampaign === c.id ? 'border-teal-600 bg-teal-50/60' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{c.name}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{c.status === 'active' ? '进行中' : '已结束'}</Badge>
                  </div>
                  <p className="text-slate-500 mt-0.5">{c.regionDesc || '未填区域描述'} · 对象 {objs.length} 个{open > 0 && <span className="text-red-500"> · 待闭环问题 {open}</span>}</p>
                </button>
              )
            })}
            {campaigns.length === 0 && <p className="text-xs text-slate-400">暂无行动，请管理员发起</p>}
          </div>
        </div>

        {/* 对象列表 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 border-b space-y-2">
            <h3 className="font-semibold text-sm">督导对象（{objects.length}）
              {campaign && <span className="text-xs font-normal text-slate-400 ml-1">属于：{campaign.name}</span>}
            </h3>
            {isAdmin && campaign && (
              <div className="flex gap-2">
                <Button size="sm" variant={mode === 'building' ? 'default' : 'outline'} className="flex-1 h-8 text-xs"
                  onClick={() => { setMode(mode === 'building' ? null : 'building'); setPicked(null); setRoadPts([]); setErr('') }}>
                  <Building2 className="w-3.5 h-3.5 mr-1" />建筑点位
                </Button>
                <Button size="sm" variant={mode === 'road' ? 'default' : 'outline'} className="flex-1 h-8 text-xs"
                  onClick={() => { setMode(mode === 'road' ? null : 'road'); setRoadPts([]); setPicked(null); setErr('') }}>
                  <Route className="w-3.5 h-3.5 mr-1" />道路线段
                </Button>
              </div>
            )}
          </div>

          {/* 建筑表单 */}
          {mode === 'building' && (
            <div className="p-3 border-b bg-teal-50/60 space-y-2 text-sm">
              <p className="font-medium text-teal-800 text-xs flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> 新增建筑点位（地图上点击选址，保存后锁定）</p>
              <Input placeholder="建筑/场所名称 *" value={bForm.name} onChange={e => setBForm({ ...bForm, name: e.target.value })} />
              <Input placeholder="地址" value={bForm.address} onChange={e => setBForm({ ...bForm, address: e.target.value })} />
              {/* 打点后自动识别附近地名，点击即可填入名称/地址 */}
              {picked && (
                <div className="border border-teal-200 rounded-md p-2 bg-white space-y-1.5 text-xs">
                  {geo.loading
                    ? <p className="text-slate-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />正在识别附近地名…</p>
                    : (geo.poi || geo.address) && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-slate-500">识别到附近（点击填入）：</span>
                        {geo.poi && <button type="button" className={chipCls} title="填入名称与地址"
                          onClick={() => setBForm(f => ({ ...f, name: geo.poi, address: geo.address || f.address }))}>🏷 {geo.poi}</button>}
                        {geo.address && <button type="button" className={chipCls} title="填入地址"
                          onClick={() => setBForm(f => ({ ...f, address: geo.address }))}>📍 {geo.address}</button>}
                      </div>
                    )}
                  <div className="flex gap-1">
                    <Input className="h-7 text-xs flex-1" placeholder="搜索附近地名（如：政务中心、图书馆、酒店）" value={geo.kw}
                      onChange={e => setGeo({ ...geo, kw: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && void doSearch(picked[0], picked[1])} />
                    <Button type="button" size="sm" variant="outline" className="h-7 text-xs px-2" disabled={geo.searching}
                      onClick={() => void doSearch(picked[0], picked[1])}>
                      {geo.searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    </Button>
                  </div>
                  {geo.results.length > 0 && (
                    <div className="max-h-32 overflow-auto divide-y border rounded">
                      {geo.results.map((r, i) => (
                        <button key={i} type="button" className="w-full text-left px-2 py-1 hover:bg-teal-50 flex justify-between gap-2"
                          onClick={() => setBForm(f => ({ ...f, name: r.name, address: r.address || f.address }))}>
                          <span className="truncate">{r.name}</span>
                          <span className="text-slate-400 shrink-0">{r.distance}m</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <select className={selCls} value={bForm.group} onChange={e => { const g = e.target.value; setBForm({ ...bForm, group: g, subtype: BUILDING_SUBTYPES.find(s => s.group === g)!.id }) }}>
                  {BUILDING_GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <select className={selCls} value={bForm.subtype} onChange={e => setBForm({ ...bForm, subtype: e.target.value })}>
                  {subtypes.map(s => <option key={s.id} value={s.id}>{s.name}{s.star ? ' ★' : ''}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <select className={selCls} value={bForm.nature} onChange={e => setBForm({ ...bForm, nature: e.target.value })}>
                  {['新建', '改建', '扩建', '既有'].map(n => <option key={n}>{n}</option>)}
                </select>
                <Input placeholder="责任单位 *" value={bForm.owner} onChange={e => setBForm({ ...bForm, owner: e.target.value })} />
              </div>
              <Input placeholder="联系电话 *（责任单位联系人电话）" value={bForm.contact} onChange={e => setBForm({ ...bForm, contact: e.target.value })} />
              <p className="text-xs text-slate-500">位置：{picked ? `${picked[0].toFixed(5)}, ${picked[1].toFixed(5)}` : '未选点——请在地图上点击'}</p>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" className="accent-teal-700" checked={bForm.publish} onChange={e => setBForm({ ...bForm, publish: e.target.checked })} />
                同时发布督导任务到任务池（待领取）
                {bForm.publish && (
                  <span className="flex items-center gap-1 ml-1">截止
                    <input type="date" className="border rounded px-1 py-0.5 bg-background" value={bForm.deadline} onChange={e => setBForm({ ...bForm, deadline: e.target.value })} />
                  </span>
                )}
              </label>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <Button size="sm" className="w-full h-8" disabled={createPoint.isPending} onClick={() => void saveBuilding()}>保存建筑点位</Button>
            </div>
          )}

          {/* 道路表单 */}
          {mode === 'road' && (
            <div className="p-3 border-b bg-sky-50/60 space-y-2 text-sm">
              <p className="font-medium text-sky-800 text-xs flex items-center gap-1"><Route className="w-3.5 h-3.5" /> 新增道路线段（依次点击起点、终点）</p>
              <Input placeholder="道路/路段名称 *（如：文三路人行道古荡段）" value={rForm.name} onChange={e => setRForm({ ...rForm, name: e.target.value })} />
              <Input placeholder="路段描述" value={rForm.address} onChange={e => setRForm({ ...rForm, address: e.target.value })} />
              {roadPts.length === 2 && !geo.loading && (geo.address || geo.poi) && (
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <span className="text-slate-500">识别到附近（点击填入）：</span>
                  {geo.address && <button type="button" className={chipCls}
                    onClick={() => setRForm(f => ({ ...f, address: geo.address }))}>📍 {geo.address}</button>}
                  {geo.poi && geo.poi !== geo.address && <button type="button" className={chipCls}
                    onClick={() => setRForm(f => ({ ...f, address: `${geo.address || geo.poi}（${geo.poi}附近）` }))}>🏷 {geo.poi}</button>}
                </div>
              )}
              <div className="flex gap-2">
                <Input placeholder="责任单位 *" value={rForm.owner} onChange={e => setRForm({ ...rForm, owner: e.target.value })} />
                <Input placeholder="联系电话 *" value={rForm.contact} onChange={e => setRForm({ ...rForm, contact: e.target.value })} />
              </div>
              <p className="text-xs text-slate-500">
                {roadPts.length === 0 ? '未选点——请先点击道路起点' : roadPts.length === 1 ? `起点已选，请再点击终点` : `线段约 ${distM(roadPts[0][0], roadPts[0][1], roadPts[1][0], roadPts[1][1])} 米`}
              </p>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                <input type="checkbox" className="accent-sky-700" checked={rForm.publish} onChange={e => setRForm({ ...rForm, publish: e.target.checked })} />
                同时发布督导任务到任务池（待领取）
                {rForm.publish && (
                  <span className="flex items-center gap-1 ml-1">截止
                    <input type="date" className="border rounded px-1 py-0.5 bg-background" value={rForm.deadline} onChange={e => setRForm({ ...rForm, deadline: e.target.value })} />
                  </span>
                )}
              </label>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <Button size="sm" className="w-full h-8" disabled={createPoint.isPending} onClick={() => void saveRoad()}>保存道路线段</Button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {objectsPg.pageItems.map(p => {
              const st = SUBTYPE_MAP[p.subtypeId]
              const sm = POINT_STATUS_META[p.status]
              const open = issueCount(p.id)
              return (
                <div key={p.id} className="px-3 py-2.5 border-b hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate flex items-center gap-1">
                      {p.kind === 'road' ? <Route className="w-3.5 h-3.5 text-sky-600 shrink-0" /> : <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />}
                      {p.name}{st?.star && <span className="text-amber-500">★</span>}
                    </span>
                    <Badge style={{ backgroundColor: sm.color }} className="text-white shrink-0 text-[11px]">{sm.label}</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.kind === 'road' ? `道路线段 · 约 ${distM(p.lat, p.lng, p.lat2!, p.lng2!)} 米` : `建筑点位 · ${st?.name}`} · {p.nature}
                    {open > 0 && <span className="text-red-500"> · 待闭环问题 {open}</span>}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Lock className="w-3 h-3" /> 位置与类别已锁定</p>
                </div>
              )
            })}
            {objects.length === 0 && <p className="p-4 text-sm text-slate-400">该行动暂无督导对象{isAdmin ? '，可用上方按钮添加建筑点位或道路线段' : ''}</p>}
            <div className="px-3 pb-2">
              <Pager page={objectsPg.page} totalPages={objectsPg.totalPages} total={objectsPg.total} onChange={objectsPg.setPage} />
            </div>
          </div>
        </div>
      </div>

      {/* 地图 */}
      <div className="flex-1 relative">
        <MapContainer center={org.center} zoom={12} className="absolute inset-0" key={org.id}>
          <TileLayer url={TDT_VEC} subdomains={TDT_SUBDOMAINS} attribution="天地图" />
          <TileLayer url={TDT_CVA} subdomains={TDT_SUBDOMAINS} />
          <Rectangle bounds={org.bounds} pathOptions={{ color: '#0f807c', weight: 2, dashArray: '6 6', fillOpacity: 0.02 }} />
          {campaign?.bounds && <Rectangle bounds={campaign.bounds} pathOptions={{ color: '#d97706', weight: 2, dashArray: '4 4', fillOpacity: 0.04 }} />}
          {mode && <ClickCapture onPick={onPick} />}

          {/* 框选预览 */}
          {corners.length > 0 && corners.map((c, i) => <CircleMarker key={i} center={c} radius={7} pathOptions={{ color: '#d97706', fillColor: '#d97706', fillOpacity: 0.8 }} />)}
          {corners.length === 2 && <Rectangle bounds={toBounds(corners)} pathOptions={{ color: '#d97706', weight: 2, fillOpacity: 0.06 }} />}
          {picked && <CircleMarker center={picked} radius={10} pathOptions={{ color: '#0f807c', fillColor: '#0f807c', fillOpacity: 0.7 }} />}
          {roadPts.map((c, i) => <CircleMarker key={i} center={c} radius={7} pathOptions={{ color: '#0284c7', fillColor: '#0284c7', fillOpacity: 0.8 }} />)}
          {roadPts.length === 2 && <Polyline positions={roadPts} pathOptions={{ color: '#0284c7', weight: 5, dashArray: '2 6' }} />}

          {/* 督导对象 */}
          {objects.map(p => {
            const sm = POINT_STATUS_META[p.status]
            const st = SUBTYPE_MAP[p.subtypeId]
            const open = issueCount(p.id)
            const popup = (
              <Popup>
                <div className="text-sm min-w-[210px]">
                  <p className="font-semibold">{p.kind === 'road' ? '🛣 ' : '🏢 '}{p.name}{st?.star ? ' ★' : ''}</p>
                  <p className="text-xs text-slate-500 mt-1">{p.kind === 'road' ? `道路线段 · 约 ${distM(p.lat, p.lng, p.lat2!, p.lng2!)} 米` : `建筑点位 · ${st?.name}`} · {p.nature}</p>
                  <p className="text-xs text-slate-500">{p.address}</p>
                  <p className="text-xs mt-1">状态：<b style={{ color: sm.color }}>{sm.label}</b>{open > 0 && <span className="text-red-500">（待闭环问题 {open}）</span>}</p>
                  <p className="text-xs text-slate-500">责任单位：{p.owner || '—'}</p>
                  <div className="text-xs mt-1 border-t pt-1">
                    适用检查项：
                    {(MATRIX[p.subtypeId] || []).map((lv, i) => lv === 'NA' ? null : (
                      <span key={i} className={`mr-1 ${LEVEL_META[lv].tone}`} title={FACILITIES[i].name + ' · ' + LEVEL_META[lv].label}>
                        {LEVEL_META[lv].symbol}{FACILITIES[i].short}
                      </span>
                    ))}
                  </div>
                </div>
              </Popup>
            )
            if (p.kind === 'road' && p.lat2 != null && p.lng2 != null) {
              return (
                <span key={p.id}>
                  <Polyline positions={[[p.lat, p.lng], [p.lat2, p.lng2]]} pathOptions={{ color: sm.color, weight: 6, opacity: 0.85 }} />
                  <CircleMarker center={[p.lat, p.lng]} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: sm.color, fillOpacity: 1 }} />
                  <CircleMarker center={[p.lat2, p.lng2]} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: sm.color, fillOpacity: 1 }} />
                  <CircleMarker center={[(p.lat + p.lat2) / 2, (p.lng + p.lng2) / 2]} radius={9} pathOptions={{ color: '#fff', weight: 2, fillColor: sm.color, fillOpacity: 0.9 }}>{popup}</CircleMarker>
                </span>
              )
            }
            return (
              <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={9}
                pathOptions={{ color: '#fff', weight: 2, fillColor: sm.color, fillOpacity: 0.9 }}>{popup}</CircleMarker>
            )
          })}
        </MapContainer>

        <Card className="absolute bottom-4 right-4 z-[1000] w-60 shadow-lg">
          <CardHeader className="py-2 px-3"><CardTitle className="text-xs">图例</CardTitle></CardHeader>
          <CardContent className="px-3 pb-3 pt-0 space-y-1">
            <p className="text-[11px] text-slate-500">— 虚线框：<span className="text-teal-700">组织督导区域</span> / <span className="text-amber-700">行动区域</span></p>
            <p className="text-[11px] text-slate-500">— 圆点：建筑点位；粗线段：道路（两端+中点）</p>
            <div className="grid grid-cols-2 gap-1 pt-1">
              {Object.entries(POINT_STATUS_META).map(([k, v]) => (
                <span key={k} className="text-[11px] flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: v.color }} />{v.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
