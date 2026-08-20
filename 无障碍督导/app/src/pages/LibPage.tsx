import { Fragment, useMemo, useState } from 'react'
import { MATRIX, FACILITIES, LEVEL_META, BUILDING_GROUPS, BUILDING_SUBTYPES, buildFacilityRows, facilityName, PARAM_TABLE, type Level } from '@/data/checklib'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen } from 'lucide-react'

const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

export default function LibPage() {
  const [group, setGroup] = useState('office')
  const [subtype, setSubtype] = useState('gov')
  const items = useMemo(() => buildFacilityRows(subtype), [subtype])
  const subs = BUILDING_SUBTYPES.filter(s => s.group === group)

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h2 className="text-lg font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5 text-teal-700" /> 检查项库
          <span className="text-xs font-normal text-slate-400">依据《各类建筑无障碍设施配置清单表格22》＋ GB 55019-2021（G19 主）/ GB 50763-2012（G63 补充）</span>
        </h2>

        {/* 配置矩阵 */}
        <Card>
          <CardHeader><CardTitle className="text-base">总体配置矩阵（●必须 ○条件 △推荐 —不适用）</CardTitle></CardHeader>
          <CardContent className="overflow-auto">
            <table className="text-xs border-collapse min-w-[900px]">
              <thead>
                <tr>
                  <th className="border px-2 py-1.5 bg-slate-100 text-left sticky left-0">建筑/场所类型</th>
                  {FACILITIES.map(f => <th key={f.id} className="border px-2 py-1.5 bg-slate-100 whitespace-nowrap">{f.short}</th>)}
                </tr>
              </thead>
              <tbody>
                {BUILDING_GROUPS.map(g => (
                  <Fragment key={g.id}>
                    <tr><td colSpan={15} className="border px-2 py-1 bg-teal-50 font-semibold text-teal-800">{g.name}</td></tr>
                    {BUILDING_SUBTYPES.filter(s => s.group === g.id).map(s => (
                      <tr key={s.id} className={s.id === subtype ? 'bg-amber-50' : ''}>
                        <td className="border px-2 py-1 whitespace-nowrap sticky left-0 bg-white">{s.name}{s.star && <span className="text-amber-500">★</span>}</td>
                        {(MATRIX[s.id] || []).map((lv: Level, i: number) => (
                          <td key={i} className={`border px-2 py-1 text-center font-bold ${LEVEL_META[lv].tone}`}>{LEVEL_META[lv].symbol}</td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* 详细检查项 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-3 flex-wrap">
              各类建筑无障碍设施配置详细要求
              <select className={selCls} value={group} onChange={e => { setGroup(e.target.value); setSubtype(BUILDING_SUBTYPES.find(s => s.group === e.target.value)!.id) }}>
                {BUILDING_GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <select className={selCls} value={subtype} onChange={e => setSubtype(e.target.value)}>
                {subs.map(s => <option key={s.id} value={s.id}>{s.name}{s.star ? ' ★' : ''}</option>)}
              </select>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="text-xs border-collapse w-full min-w-[860px]">
              <thead><tr>
                <th className="border px-2 py-1.5 bg-slate-100">设施类别</th>
                <th className="border px-2 py-1.5 bg-slate-100">配置等级</th>
                <th className="border px-2 py-1.5 bg-slate-100">检查点</th>
                <th className="border px-2 py-1.5 bg-slate-100 text-left">具体要求说明</th>
                <th className="border px-2 py-1.5 bg-slate-100">条款依据</th>
                <th className="border px-2 py-1.5 bg-slate-100">判定方式</th>
              </tr></thead>
              <tbody>
                {items.map(row => (
                  <Fragment key={row.facility}>
                    {row.typeNote && (
                      <tr className="bg-teal-50/60">
                        <td className="border px-2 py-1.5 whitespace-nowrap font-medium">{facilityName(row.facility)}</td>
                        <td className="border px-2 py-1.5 text-center"><Badge variant="secondary" className="text-[10px]">{LEVEL_META[row.level].symbol} {LEVEL_META[row.level].label}</Badge></td>
                        <td className="border px-2 py-1.5 text-teal-800">类型配置要求</td>
                        <td className="border px-2 py-1.5">{row.typeNote}{row.condition && <span className="text-amber-600">（条件：{row.condition}）</span>}</td>
                        <td className="border px-2 py-1.5 whitespace-nowrap text-slate-500">{row.typeClause}</td>
                        <td className="border px-2 py-1.5 whitespace-nowrap text-slate-400">—</td>
                      </tr>
                    )}
                    {row.items.map((it, i) => (
                      <tr key={it.key}>
                        <td className="border px-2 py-1.5 whitespace-nowrap font-medium">{!row.typeNote && i === 0 ? facilityName(row.facility) : ''}</td>
                        <td className="border px-2 py-1.5 text-center">{!row.typeNote && i === 0 ? <Badge variant="secondary" className="text-[10px]">{LEVEL_META[row.level].symbol} {LEVEL_META[row.level].label}</Badge> : ''}</td>
                        <td className="border px-2 py-1.5 whitespace-nowrap">{it.aspect}</td>
                        <td className="border px-2 py-1.5">{it.requirement}{it.condition && <span className="text-amber-600">（条件：{it.condition}）</span>}</td>
                        <td className="border px-2 py-1.5 whitespace-nowrap text-slate-500">{it.clause}</td>
                        <td className="border px-2 py-1.5 whitespace-nowrap">{it.param ? <span className="text-teal-700">自动（{it.param.label} {it.param.kind === 'min' ? '≥' + it.param.min : it.param.kind === 'max' ? '≤' + it.param.max : `${it.param.min}–${it.param.max}`}{it.param.unit}）</span> : '人工判定'}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* 参数速查 */}
        <Card>
          <CardHeader><CardTitle className="text-base">关键技术参数速查表</CardTitle></CardHeader>
          <CardContent className="overflow-auto">
            <table className="text-xs border-collapse w-full min-w-[640px]">
              <thead><tr>
                <th className="border px-2 py-1.5 bg-slate-100">设施类别</th>
                <th className="border px-2 py-1.5 bg-slate-100">参数名称</th>
                <th className="border px-2 py-1.5 bg-slate-100 text-left">数值要求</th>
                <th className="border px-2 py-1.5 bg-slate-100">条款依据</th>
              </tr></thead>
              <tbody>
                {PARAM_TABLE.map((r, i) => (
                  <tr key={i}>
                    <td className="border px-2 py-1.5 whitespace-nowrap">{r.facility}</td>
                    <td className="border px-2 py-1.5 whitespace-nowrap">{r.param}</td>
                    <td className="border px-2 py-1.5">{r.value}</td>
                    <td className="border px-2 py-1.5 whitespace-nowrap text-slate-500">{r.clause}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
