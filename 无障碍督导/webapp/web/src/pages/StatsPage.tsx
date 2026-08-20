import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Rectangle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { TDT_VEC, TDT_CVA, TDT_SUBDOMAINS } from '@/config'
import { distM, POINT_STATUS_META } from '@/store/app'
import { useAuth } from '@/auth/AuthContext'
import { useCampaigns, useIssues, usePoints, useStats } from '@/api/hooks'
import { Pager, usePager } from '@/components/Pager'
import { facilityName, SUBTYPE_MAP } from '@/data/checklib'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Loader2 } from 'lucide-react'

const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

/** 达标率颜色：≥90 绿 / ≥60 橙 / <60 红 */
const rateColor = (r: number | null) => (r == null ? '#94a3b8' : r >= 90 ? '#22c55e' : r >= 60 ? '#f59e0b' : '#ef4444')

function RateBar({ rate, text }: { rate: number | null; text?: string }) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-3.5 bg-slate-100 rounded overflow-hidden">
        <div className="h-full rounded" style={{ width: `${rate ?? 0}%`, backgroundColor: rateColor(rate) }} />
      </div>
      <span className="text-xs w-14 text-right shrink-0" style={{ color: rateColor(rate) }}>
        {rate == null ? '—' : `${rate}%`}{text ? ` ${text}` : ''}
      </span>
    </div>
  )
}

export default function StatsPage() {
  const { org } = useAuth()
  const { data: campaigns = [] } = useCampaigns()
  const { data: allPoints = [] } = usePoints()
  const { data: issues = [] } = useIssues()
  const [campaignId, setCampaignId] = useState<string>('')
  const { data: s, isLoading } = useStats(campaignId || undefined)

  /** 项目地图点位：随行动筛选联动 */
  const mapPoints = useMemo(
    () => (campaignId ? allPoints.filter(p => p.campaignId === campaignId) : allPoints),
    [allPoints, campaignId],
  )
  const openIssueCount = (pointId: string) =>
    issues.filter(i => i.pointId === pointId && i.status !== 'closed' && i.status !== 'deferred').length

  const byStatus = useMemo(() => {
    const m = new Map((s?.pointsByStatus ?? []).map(x => [x.status, x.count]))
    return Object.entries(POINT_STATUS_META).map(([k, v]) => ({
      label: v.label, color: v.color, n: m.get(k as keyof typeof POINT_STATUS_META) ?? 0,
    }))
  }, [s])

  const byFacility = useMemo(
    () => (s?.issuesByFacility ?? []).map(x => [x.facility, x.count] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [s],
  )

  const starPg = usePager(s?.starPoints ?? [], 8)
  const facPg = usePager(s?.facilityStats ?? [], 10)
  const subPg = usePager(s?.subtypeStats ?? [], 10)

  if (isLoading || !s) {
    return <div className="h-full flex items-center justify-center text-teal-800"><Loader2 className="w-5 h-5 animate-spin mr-2" />统计加载中…</div>
  }

  const coverage = s.pointsTotal ? Math.round(s.inspectedPoints / s.pointsTotal * 100) : 0
  const fixRate = s.issuesTotal ? Math.round(s.issuesClosed / s.issuesTotal * 100) : 0
  const maxFac = byFacility[0]?.[1] ?? 1
  const starDone = s.starPoints.filter(p => p.status !== 'pending').length
  const campaign = campaigns.find(c => c.id === campaignId)
  const SEV_LABEL: Record<string, string> = { M: '强制性条文', C: '一般问题', R: '建议改进' }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-teal-700" /> 统计分析</h2>
          <span className="flex-1" />
          {/* 行动筛选：缺省为全部任务口径 */}
          <select className={selCls + ' min-w-[220px]'} value={campaignId} onChange={e => setCampaignId(e.target.value)}>
            <option value="">全部督导行动</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-400 -mt-4">
          数据范围：{org ? `${org.name}（${org.regionName}）` : '平台汇总'}{campaign ? ` · 行动：${campaign.name}` : ''}
        </p>

        <div className="grid grid-cols-4 gap-4">
          {[['点位总数', s.pointsTotal], ['督导覆盖率', coverage + '%'], ['问题单总数', s.issuesTotal], ['整改销号率', fixRate + '%']].map(([l, v]) => (
            <Card key={l as string}><CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-teal-800">{v}</p><p className="text-xs text-slate-500 mt-1">{l}</p>
            </CardContent></Card>
          ))}
        </div>

        {/* 项目地图（随行动筛选联动） */}
        <Card>
          <CardHeader><CardTitle className="text-sm">项目地图
            <span className="text-xs font-normal text-slate-400 ml-1">点位按状态着色，点击查看概况{campaign ? ` · 当前行动：${campaign.name}` : ''}</span></CardTitle></CardHeader>
          <CardContent className="p-2">
            <div className="h-[360px] rounded-md overflow-hidden">
              <MapContainer center={org?.center ?? [30.25, 120.12]} zoom={12} className="h-full w-full" key={`${org?.id ?? 'platform'}-${campaignId}`}>
                <TileLayer url={TDT_VEC} subdomains={TDT_SUBDOMAINS} attribution="天地图" />
                <TileLayer url={TDT_CVA} subdomains={TDT_SUBDOMAINS} />
                {org?.bounds && <Rectangle bounds={org.bounds} pathOptions={{ color: '#0f807c', weight: 2, dashArray: '6 6', fillOpacity: 0.02 }} />}
                {campaign?.bounds && <Rectangle bounds={campaign.bounds} pathOptions={{ color: '#d97706', weight: 2, dashArray: '4 4', fillOpacity: 0.04 }} />}
                {mapPoints.map(p => {
                  const sm = POINT_STATUS_META[p.status]
                  const st = SUBTYPE_MAP[p.subtypeId]
                  const open = openIssueCount(p.id)
                  const popup = (
                    <Popup>
                      <div className="text-sm min-w-[200px]">
                        <p className="font-semibold">{p.kind === 'road' ? '🛣 ' : '🏢 '}{p.name}{st?.star ? ' ★' : ''}</p>
                        <p className="text-xs text-slate-500 mt-1">{p.kind === 'road' ? `道路线段 · 约 ${distM(p.lat, p.lng, p.lat2!, p.lng2!)} 米` : `建筑点位 · ${st?.name}`} · {p.nature}</p>
                        <p className="text-xs mt-1">状态：<b style={{ color: sm.color }}>{sm.label}</b>{open > 0 && <span className="text-red-500">（待闭环问题 {open}）</span>}</p>
                      </div>
                    </Popup>
                  )
                  if (p.kind === 'road' && p.lat2 != null && p.lng2 != null) {
                    return (
                      <span key={p.id}>
                        <Polyline positions={[[p.lat, p.lng], [p.lat2, p.lng2]]} pathOptions={{ color: sm.color, weight: 6, opacity: 0.85 }} />
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
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-2">
              {Object.entries(POINT_STATUS_META).map(([k, v]) => (
                <span key={k} className="text-[11px] text-slate-500 flex items-center gap-1">
                  <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: v.color }} />{v.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 整改落实情况 */}
        <Card>
          <CardHeader><CardTitle className="text-sm">整改落实情况</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="border rounded-md p-3 bg-white">
                <p className="text-2xl font-bold text-teal-800">{s.rectification.closeRate == null ? '—' : `${s.rectification.closeRate}%`}</p>
                <p className="text-xs text-slate-500">问题闭环率（{s.rectification.closed}/{s.rectification.total}）</p>
              </div>
              <div className="border rounded-md p-3 bg-white">
                <p className="text-2xl font-bold text-teal-800">{s.rectification.avgCloseDays == null ? '—' : s.rectification.avgCloseDays}</p>
                <p className="text-xs text-slate-500">平均闭环天数</p>
              </div>
              <div className="border rounded-md p-3 bg-white">
                <p className={`text-2xl font-bold ${s.rectification.overdue > 0 ? 'text-red-600' : 'text-teal-800'}`}>{s.rectification.overdue}</p>
                <p className="text-xs text-slate-500">逾期未闭环（超整改期限）</p>
              </div>
            </div>
            <div className="space-y-1.5">
              {s.rectification.bySeverity.map(v => (
                <div key={v.severity} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0">{SEV_LABEL[v.severity]}</span>
                  <RateBar rate={v.total ? Math.round(v.closed / v.total * 100) : null} text={`${v.closed}/${v.total}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 各类设施达标率 */}
        <Card>
          <CardHeader><CardTitle className="text-sm">各类设施达标率
            <span className="text-xs font-normal text-slate-400 ml-1">按检查点判定统计（"本处不涉及"不计入）；按达标率升序，薄弱环节排前</span></CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-slate-400 px-1">
              <span className="w-28 shrink-0">设施类别</span>
              <span className="flex-1">检查点达标率</span>
              <span className="w-20 text-right shrink-0">问题单（闭环/总）</span>
            </div>
            {facPg.pageItems.map(f => (
              <div key={f.facility} className="flex items-center gap-2 border rounded px-2 py-1.5 bg-white">
                <span className="w-28 shrink-0 truncate">{facilityName(f.facility)}</span>
                <RateBar rate={f.rate} text={`${f.pass}/${f.checked}`} />
                <span className="w-20 text-right shrink-0 text-slate-500">{f.issuesClosed}/{f.issues}</span>
              </div>
            ))}
            {s.facilityStats.length === 0 && <p className="text-slate-400">暂无核查数据</p>}
            <Pager page={facPg.page} totalPages={facPg.totalPages} total={facPg.total} onChange={facPg.setPage} />
          </CardContent>
        </Card>

        {/* 各类型建筑/道路达标情况 */}
        <Card>
          <CardHeader><CardTitle className="text-sm">各类型建筑/道路达标情况
            <span className="text-xs font-normal text-slate-400 ml-1">达标 = 已督导且无未闭环问题</span></CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2 text-slate-400 px-1">
              <span className="w-32 shrink-0">类型</span>
              <span className="w-16 text-right shrink-0">点位</span>
              <span className="w-16 text-right shrink-0">已督导</span>
              <span className="flex-1">达标率</span>
              <span className="w-20 text-right shrink-0">问题闭环</span>
            </div>
            {subPg.pageItems.map(t => (
              <div key={t.subtypeId} className="flex items-center gap-2 border rounded px-2 py-1.5 bg-white">
                <span className="w-32 shrink-0 truncate">{SUBTYPE_MAP[t.subtypeId]?.star && <span className="text-amber-500">★</span>}{SUBTYPE_MAP[t.subtypeId]?.name ?? t.subtypeId}</span>
                <span className="w-16 text-right shrink-0">{t.points}</span>
                <span className="w-16 text-right shrink-0">{t.inspected}</span>
                <RateBar rate={t.qualifiedRate} text={`${t.qualified}/${t.inspected}`} />
                <span className="w-20 text-right shrink-0 text-slate-500">{t.issuesClosed}/{t.issues}</span>
              </div>
            ))}
            {s.subtypeStats.length === 0 && <p className="text-slate-400">暂无点位数据</p>}
            <Pager page={subPg.page} totalPages={subPg.totalPages} total={subPg.total} onChange={subPg.setPage} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">点位状态分布</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {byStatus.map(st => (
                <div key={st.label} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0">{st.label}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${s.pointsTotal ? st.n / s.pointsTotal * 100 : 0}%`, backgroundColor: st.color }} />
                  </div>
                  <span className="w-6 text-right">{st.n}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">问题设施类别 TOP</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {byFacility.map(([f, n]) => (
                <div key={f} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 truncate">{facilityName(f)}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full bg-red-400 rounded" style={{ width: `${n / maxFac * 100}%` }} />
                  </div>
                  <span className="w-6 text-right">{n}</span>
                </div>
              ))}
              {byFacility.length === 0 && <p className="text-xs text-slate-400">暂无问题数据</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-sm">★ 重点配置对象专项台账</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="text-slate-500">重点对象 {s.starPoints.length} 个，已督导 {starDone} 个</p>
            {starPg.pageItems.map(p => (
              <div key={p.id} className="flex items-center justify-between border rounded px-3 py-1.5 bg-white">
                <span>{p.name} <span className="text-slate-400">（{SUBTYPE_MAP[p.subtypeId]?.name}）</span></span>
                <span style={{ color: POINT_STATUS_META[p.status].color }}>{POINT_STATUS_META[p.status].label}</span>
              </div>
            ))}
            {s.starPoints.length === 0 && <p className="text-slate-400">本区域暂无重点配置对象点位</p>}
            <Pager page={starPg.page} totalPages={starPg.totalPages} total={starPg.total} onChange={starPg.setPage} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
