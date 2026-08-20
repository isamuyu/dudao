import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Rectangle, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { TDT_VEC, TDT_CVA, TDT_SUBDOMAINS } from '@/config'
import { useStore, useCurrent, inRegion, inBounds, distM, uid, POINT_STATUS_META, type PointStatus } from '@/store/app'
import { BUILDING_GROUPS, BUILDING_SUBTYPES, SUBTYPE_MAP, MATRIX, FACILITIES, LEVEL_META } from '@/data/checklib'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Building2, Flag, Lock, MapPin, Plus, Route } from 'lucide-react'

type Mode = null | 'region' | 'building' | 'road'
type LatLng = [number, number]

function ClickCapture({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm w-full'

export default function MapPage() {
  const { state, dispatch } = useStore()
  const { org, user } = useCurrent()
  const campaigns = state.campaigns.filter(c => c.orgId === org.id)
  const [selCampaign, setSelCampaign] = useState<string | null>(campaigns[0]?.id ?? null)
  useEffect(() => { setSelCampaign(state.campaigns.find(c => c.orgId === org.id)?.id ?? null); resetModes() }, [org.id]) // eslint-disable-line

  const campaign = campaigns.find(c => c.id === selCampaign) ?? null
  const objects = useMemo(
    () => state.points.filter(p => p.orgId === org.id && p.campaignId === selCampaign),
    [state.points, org.id, selCampaign],
  )
  const issueCount = (pointId: string) => state.issues.filter(i => i.pointId === pointId && i.status !== 'closed').length

  const [mode, setMode] = useState<Mode>(null)
  const [corners, setCorners] = useState<LatLng[]>([])      // 行动区域两角
  const [roadPts, setRoadPts] = useState<LatLng[]>([])      // 道路起终点
  const [picked, setPicked] = useState<LatLng | null>(null) // 建筑点位
  const [cForm, setCForm] = useState({ name: '', regionDesc: '' })
  const [creatingCampaign, setCreatingCampaign] = useState(false)
  const [bForm, setBForm] = useState({ name: '', address: '', group: 'office', subtype: 'gov', nature: '既有', owner: '', contact: '' })
  const [rForm, setRForm] = useState({ name: '', address: '', owner: '', contact: '' })
  const [err, setErr] = useState('')

  function resetModes() {
    setMode(null); setCorners([]); setRoadPts([]); setPicked(null); setErr(''); setCreatingCampaign(false)
  }

  const onPick = (lat: number, lng: number) => {
    setErr('')
    if (mode === 'region') {
      setCorners(prev => prev.length >= 2 ? [ [lat, lng] ] : [...prev, [lat, lng]])
    } else if (mode === 'building') setPicked([lat, lng])
    else if (mode === 'road') setRoadPts(prev => prev.length >= 2 ? [[lat, lng]] : [...prev, [lat, lng]])
  }

  const toBounds = (cs: LatLng[]): [[number, number], [number, number]] => [
    [Math.min(cs[0][0], cs[1][0]), Math.min(cs[0][1], cs[1][1])],
    [Math.max(cs[0][0], cs[1][0]), Math.max(cs[0][1], cs[1][1])],
  ]

  const saveCampaign = () => {
    if (!cForm.name.trim()) { setErr('请填写行动名称'); return }
    if (corners.length !== 2) { setErr('请在地图上点击两个角点框选行动大致区域'); return }
    dispatch({
      type: 'ADD_CAMPAIGN',
      campaign: { id: uid('c'), orgId: org.id, name: cForm.name.trim(), regionDesc: cForm.regionDesc, bounds: toBounds(corners), createdBy: user.name, createdAt: new Date().toLocaleDateString('zh-CN'), status: 'active' },
    })
    resetModes()
  }

  const checkScope = (lat: number, lng: number): string | null => {
    if (!inRegion(org, lat, lng)) return `超出本组织督导区域（${org.regionName}）`
    if (campaign && !inBounds(campaign.bounds, lat, lng)) return '超出本行动划定区域'
    return null
  }

  const saveBuilding = () => {
    if (!picked) { setErr('请先在地图上点击选择建筑位置'); return }
    if (!bForm.name.trim()) { setErr('请填写建筑名称'); return }
    const e = checkScope(picked[0], picked[1]); if (e) { setErr(e); return }
    dispatch({
      type: 'ADD_POINT',
      point: { id: uid('p'), orgId: org.id, campaignId: selCampaign!, kind: 'building', name: bForm.name.trim(), address: bForm.address, lat: +picked[0].toFixed(6), lng: +picked[1].toFixed(6), subtypeId: bForm.subtype, nature: bForm.nature, owner: bForm.owner, contact: bForm.contact, status: 'pending', locked: true, createdBy: user.name },
    })
    setMode(null); setPicked(null); setBForm({ ...bForm, name: '', address: '' }); setErr('')
  }

  const saveRoad = () => {
    if (roadPts.length !== 2) { setErr('请在地图上依次点击道路的起点和终点'); return }
    if (!rForm.name.trim()) { setErr('请填写道路/路段名称'); return }
    const e = checkScope(roadPts[0][0], roadPts[0][1]) ?? checkScope(roadPts[1][0], roadPts[1][1]); if (e) { setErr(e); return }
    dispatch({
      type: 'ADD_POINT',
      point: { id: uid('p'), orgId: org.id, campaignId: selCampaign!, kind: 'road', name: rForm.name.trim(), address: rForm.address, lat: +roadPts[0][0].toFixed(6), lng: +roadPts[0][1].toFixed(6), lat2: +roadPts[1][0].toFixed(6), lng2: +roadPts[1][1].toFixed(6), subtypeId: 'road', nature: '既有', owner: rForm.owner, contact: rForm.contact, status: 'pending', locked: true, createdBy: user.name },
    })
    setMode(null); setRoadPts([]); setRForm({ name: '', address: '', owner: '', contact: '' }); setErr('')
  }

  const subtypes = BUILDING_SUBTYPES.filter(s => s.group === bForm.group)

  return (
    <div className="flex h-full">
      {/* 左侧面板 */}
      <div className="w-[400px] shrink-0 border-r flex flex-col bg-white">
        {/* 行动列表 */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm flex items-center gap-1"><Flag className="w-4 h-4 text-teal-700" /> 督导行动</h2>
            {user.role === 'admin' && (
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
                {corners.length === 2 ? `区域已框选（${corners.length}/2 角点）` : mode === 'region' ? `请在地图点击第 ${corners.length + 1} 个角点…` : '框选行动大致区域（地图两角点）'}
              </Button>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <Button size="sm" className="w-full h-8" onClick={saveCampaign}>创建行动</Button>
            </div>
          )}

          <div className="space-y-1.5 max-h-44 overflow-auto">
            {campaigns.map(c => {
              const objs = state.points.filter(p => p.campaignId === c.id)
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
            {user.role === 'admin' && campaign && (
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
                <Input placeholder="责任单位" value={bForm.owner} onChange={e => setBForm({ ...bForm, owner: e.target.value })} />
              </div>
              <p className="text-xs text-slate-500">位置：{picked ? `${picked[0].toFixed(5)}, ${picked[1].toFixed(5)}` : '未选点——请在地图上点击'}</p>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <Button size="sm" className="w-full h-8" onClick={saveBuilding}>保存建筑点位</Button>
            </div>
          )}

          {/* 道路表单 */}
          {mode === 'road' && (
            <div className="p-3 border-b bg-sky-50/60 space-y-2 text-sm">
              <p className="font-medium text-sky-800 text-xs flex items-center gap-1"><Route className="w-3.5 h-3.5" /> 新增道路线段（依次点击起点、终点）</p>
              <Input placeholder="道路/路段名称 *（如：文三路人行道古荡段）" value={rForm.name} onChange={e => setRForm({ ...rForm, name: e.target.value })} />
              <Input placeholder="路段描述" value={rForm.address} onChange={e => setRForm({ ...rForm, address: e.target.value })} />
              <Input placeholder="责任单位" value={rForm.owner} onChange={e => setRForm({ ...rForm, owner: e.target.value })} />
              <p className="text-xs text-slate-500">
                {roadPts.length === 0 ? '未选点——请先点击道路起点' : roadPts.length === 1 ? `起点已选，请再点击终点` : `线段约 ${distM(roadPts[0][0], roadPts[0][1], roadPts[1][0], roadPts[1][1])} 米`}
              </p>
              {err && <p className="text-xs text-red-600">{err}</p>}
              <Button size="sm" className="w-full h-8" onClick={saveRoad}>保存道路线段</Button>
            </div>
          )}

          <div className="flex-1 overflow-auto">
            {objects.map(p => {
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
            {objects.length === 0 && <p className="p-4 text-sm text-slate-400">该行动暂无督导对象{user.role === 'admin' ? '，可用上方按钮添加建筑点位或道路线段' : ''}</p>}
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
            const sm = POINT_STATUS_META[p.status as PointStatus]
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
