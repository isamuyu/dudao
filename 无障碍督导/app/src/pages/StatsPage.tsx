import { useMemo } from 'react'
import { useStore, useCurrent, POINT_STATUS_META } from '@/store/app'
import { facilityName, SUBTYPE_MAP } from '@/data/checklib'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function StatsPage() {
  const { state } = useStore()
  const { org } = useCurrent()
  const points = state.points.filter(p => p.orgId === org.id)
  const issues = state.issues.filter(i => i.orgId === org.id)

  const done = points.filter(p => p.status === 'closed' || p.status === 'issue' || p.status === 'recheck').length
  const coverage = points.length ? Math.round(done / points.length * 100) : 0
  const closedIssues = issues.filter(i => i.status === 'closed').length
  const fixRate = issues.length ? Math.round(closedIssues / issues.length * 100) : 0

  const byStatus = useMemo(() => Object.entries(POINT_STATUS_META).map(([k, v]) => ({
    label: v.label, color: v.color, n: points.filter(p => p.status === k).length,
  })), [points])

  const byFacility = useMemo(() => {
    const m: Record<string, number> = {}
    issues.forEach(i => { m[i.facility] = (m[i.facility] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [issues])
  const maxFac = byFacility[0]?.[1] ?? 1

  const starPoints = points.filter(p => SUBTYPE_MAP[p.subtypeId]?.star)
  const starDone = starPoints.filter(p => p.status !== 'pending').length

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-teal-700" /> 统计分析
          <span className="text-xs font-normal text-slate-400">数据范围：{org.name}（{org.regionName}）</span></h2>

        <div className="grid grid-cols-4 gap-4">
          {[['点位总数', points.length], ['督导覆盖率', coverage + '%'], ['问题单总数', issues.length], ['整改销号率', fixRate + '%']].map(([l, v]) => (
            <Card key={l as string}><CardContent className="py-4 text-center">
              <p className="text-3xl font-bold text-teal-800">{v}</p><p className="text-xs text-slate-500 mt-1">{l}</p>
            </CardContent></Card>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">点位状态分布</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {byStatus.map(s => (
                <div key={s.label} className="flex items-center gap-2 text-xs">
                  <span className="w-16 shrink-0">{s.label}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${points.length ? s.n / points.length * 100 : 0}%`, backgroundColor: s.color }} />
                  </div>
                  <span className="w-6 text-right">{s.n}</span>
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
            <p className="text-slate-500">重点对象 {starPoints.length} 个，已督导 {starDone} 个</p>
            {starPoints.map(p => (
              <div key={p.id} className="flex items-center justify-between border rounded px-3 py-1.5 bg-white">
                <span>{p.name} <span className="text-slate-400">（{SUBTYPE_MAP[p.subtypeId]?.name}）</span></span>
                <span style={{ color: POINT_STATUS_META[p.status].color }}>{POINT_STATUS_META[p.status].label}</span>
              </div>
            ))}
            {starPoints.length === 0 && <p className="text-slate-400">本区域暂无重点配置对象点位</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
