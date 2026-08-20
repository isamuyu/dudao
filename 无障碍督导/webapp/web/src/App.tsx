import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { useIsMobile } from '@/hooks/use-mobile'
import MobileShell from '@/mobile/MobileShell'
import MapPage from '@/pages/MapPage'
import TasksPage from '@/pages/TasksPage'
import InspectPage from '@/pages/InspectPage'
import IssuesPage from '@/pages/IssuesPage'
import StatsPage from '@/pages/StatsPage'
import LibPage from '@/pages/LibPage'
import LoginPage from '@/pages/LoginPage'
import UsersPage from '@/pages/UsersPage'
import PlatformPage from '@/pages/PlatformPage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Accessibility, Map as MapIcon, ClipboardList, AlertTriangle, BarChart3, BookOpen, Building2, Loader2, LogOut, Users, Globe } from 'lucide-react'

const NAV = [
  { id: 'map', label: '地图点位', icon: MapIcon },
  { id: 'tasks', label: '督导任务', icon: ClipboardList },
  { id: 'issues', label: '问题闭环', icon: AlertTriangle },
  { id: 'stats', label: '统计分析', icon: BarChart3 },
  { id: 'lib', label: '检查项库', icon: BookOpen },
] as const

const ROLE_META: Record<string, { label: string; cls: string }> = {
  platform_admin: { label: '平台管理员', cls: 'bg-purple-600 text-white' },
  admin: { label: '组织管理员', cls: 'bg-teal-600 text-white' },
  inspector: { label: '督导员', cls: 'bg-sky-600 text-white' },
}

function Shell() {
  const { user, org, logout } = useAuth()
  const [tab, setTab] = useState<string>('map')
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  if (!user) return null
  const inspecting = activeTaskId != null
  const rm = ROLE_META[user.role]

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-teal-800 text-white shrink-0">
        {/* 第一行：品牌 + 身份/租户信息 */}
        <div className="px-4 pt-2 pb-1.5 flex items-center gap-3">
          <Accessibility className="w-6 h-6 shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight whitespace-nowrap">无障碍督导系统 <span className="text-[10px] font-normal opacity-70">V1.0</span></p>
            <p className="text-[10px] opacity-70 leading-tight truncate">依据 GB 55019-2021 / GB 50763-2012 · 检查项库源自《各类建筑无障碍设施配置清单表格22》</p>
          </div>
          <span className="flex-1" />
          {org ? (
            <>
              <span className="text-xs flex items-center gap-1 bg-teal-700/60 rounded px-2 py-1 whitespace-nowrap">
                <Building2 className="w-3.5 h-3.5" />{org.name}
              </span>
              <span className="text-xs bg-teal-700/60 rounded px-2 py-1 whitespace-nowrap">督导区域：{org.regionName}</span>
            </>
          ) : (
            <span className="text-xs flex items-center gap-1 bg-teal-700/60 rounded px-2 py-1 whitespace-nowrap">
              <Globe className="w-3.5 h-3.5" />平台级账号（跨组织）
            </span>
          )}
          <span className="text-xs bg-teal-700/60 rounded px-2 py-1 whitespace-nowrap flex items-center gap-1.5">
            {user.name}
            <Badge className={rm.cls + ' text-[10px] px-1.5 py-0'}>{rm.label}</Badge>
          </span>
          <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-teal-700 h-7 text-xs"
            onClick={() => { window.location.hash = '#/m' }}>
            移动版
          </Button>
          <Button size="sm" variant="ghost" className="text-white/70 hover:text-white hover:bg-teal-700 h-7 text-xs"
            onClick={() => { if (confirm('退出登录？')) logout() }}>
            <LogOut className="w-3.5 h-3.5 mr-1" />退出登录
          </Button>
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
            {user.role === 'admin' && (
              <button onClick={() => setTab('users')}
                className={`flex items-center gap-1 text-xs rounded-t-md px-4 py-2 ${tab === 'users' ? 'bg-slate-50 text-teal-800 font-semibold' : 'text-white/85 hover:bg-teal-700'}`}>
                <Users className="w-4 h-4" />用户管理
              </button>
            )}
            {user.role === 'platform_admin' && (
              <button onClick={() => setTab('platform')}
                className={`flex items-center gap-1 text-xs rounded-t-md px-4 py-2 ${tab === 'platform' ? 'bg-slate-50 text-teal-800 font-semibold' : 'text-white/85 hover:bg-teal-700'}`}>
                <Globe className="w-4 h-4" />平台管理
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0">
        {inspecting ? <InspectPage taskId={activeTaskId} onExit={() => setActiveTaskId(null)} />
          : tab === 'map' ? <MapPage />
          : tab === 'tasks' ? <TasksPage onStart={id => setActiveTaskId(id)} />
          : tab === 'issues' ? <IssuesPage />
          : tab === 'stats' ? <StatsPage />
          : tab === 'users' && user.role === 'admin' ? <UsersPage />
          : tab === 'platform' && user.role === 'platform_admin' ? <PlatformPage />
          : <LibPage />}
      </main>
    </div>
  )
}

function Gate() {
  const { hasToken, loading, user } = useAuth()
  const isMobile = useIsMobile()
  // 手动切换：#/m 强制移动版，#/pc 强制电脑版（默认按屏幕宽度自动判断）
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const fn = () => setHash(window.location.hash)
    window.addEventListener('hashchange', fn)
    return () => window.removeEventListener('hashchange', fn)
  }, [])
  if (!hasToken || (!loading && !user)) return <LoginPage />
  if (loading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 text-teal-800">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载中…
      </div>
    )
  }
  const mobile = hash === '#/m' ? true : hash === '#/pc' ? false : isMobile
  return mobile ? <MobileShell /> : <Shell />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
