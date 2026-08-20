import { useState } from 'react'
import { StoreProvider, useStore, useCurrent } from '@/store/app'
import MapPage from '@/pages/MapPage'
import TasksPage from '@/pages/TasksPage'
import InspectPage from '@/pages/InspectPage'
import IssuesPage from '@/pages/IssuesPage'
import StatsPage from '@/pages/StatsPage'
import LibPage from '@/pages/LibPage'
import { Accessibility, Map as MapIcon, ClipboardList, AlertTriangle, BarChart3, BookOpen, Building2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const NAV = [
  { id: 'map', label: '地图点位', icon: MapIcon },
  { id: 'tasks', label: '督导任务', icon: ClipboardList },
  { id: 'issues', label: '问题闭环', icon: AlertTriangle },
  { id: 'stats', label: '统计分析', icon: BarChart3 },
  { id: 'lib', label: '检查项库', icon: BookOpen },
] as const

const selCls = 'h-8 rounded-md border border-teal-600 bg-teal-700/40 text-white px-2 text-xs'

function Shell() {
  const { state, dispatch } = useStore()
  const { org, user } = useCurrent()
  const [tab, setTab] = useState<string>('map')
  const inspecting = state.activeTaskId != null
  const orgUsers = state.users.filter(u => u.orgId === org.id)

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-teal-800 text-white shrink-0">
        {/* 第一行：品牌 + 身份/租户信息 */}
        <div className="px-4 pt-2 pb-1.5 flex items-center gap-3">
          <Accessibility className="w-6 h-6 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight whitespace-nowrap">无障碍督导系统 <span className="text-[10px] font-normal opacity-70">原型 V0.1</span></p>
            <p className="text-[10px] opacity-70 leading-tight truncate">依据 GB 55019-2021 / GB 50763-2012 · 检查项库源自《各类建筑无障碍设施配置清单表格22》</p>
          </div>
          <span className="flex-1" />
          <span className="text-xs flex items-center gap-1 bg-teal-700/60 rounded px-2 py-1 whitespace-nowrap">
            <Building2 className="w-3.5 h-3.5" /> 组织（租户）：
            <select className={selCls} value={org.id} onChange={e => dispatch({ type: 'SWITCH_ORG', orgId: e.target.value })}>
              {state.orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </span>
          <span className="text-xs bg-teal-700/60 rounded px-2 py-1 whitespace-nowrap">督导区域：{org.regionName}</span>
          <span className="text-xs bg-teal-700/60 rounded px-2 py-1 whitespace-nowrap">当前用户：
            <select className={selCls} value={user.id} onChange={e => dispatch({ type: 'SWITCH_USER', userId: e.target.value })}>
              {orgUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </span>
        </div>
        {/* 第二行：导航 */}
        {!inspecting && (
          <div className="px-4 pb-0 flex items-end gap-1">
            {NAV.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)}
                className={`flex items-center gap-1 text-xs rounded-t-md px-4 py-2 ${tab === n.id ? 'bg-slate-50 text-teal-800 font-semibold' : 'text-white/85 hover:bg-teal-700'}`}>
                <n.icon className="w-4 h-4" />{n.label}
              </button>
            ))}
            <span className="flex-1" />
            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white hover:bg-teal-700 h-7 text-xs mb-1"
              onClick={() => { if (confirm('重置为演示初始数据？')) dispatch({ type: 'RESET' }) }}>
              <RotateCcw className="w-3.5 h-3.5 mr-1" />重置演示数据
            </Button>
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0">
        {inspecting ? <InspectPage />
          : tab === 'map' ? <MapPage />
          : tab === 'tasks' ? <TasksPage />
          : tab === 'issues' ? <IssuesPage />
          : tab === 'stats' ? <StatsPage />
          : <LibPage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
