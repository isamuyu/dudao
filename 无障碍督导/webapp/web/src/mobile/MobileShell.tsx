import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import MobileTasks from './MobileTasks'
import MobileInspect from './MobileInspect'
import TaskReport from '@/components/TaskReport'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Accessibility, Building2, ClipboardList, Globe, LogOut, MonitorSmartphone, UserRound } from 'lucide-react'

const ROLE_META: Record<string, { label: string; cls: string }> = {
  platform_admin: { label: '平台管理员', cls: 'bg-purple-600 text-white' },
  admin: { label: '组织管理员', cls: 'bg-teal-600 text-white' },
  inspector: { label: '督导员', cls: 'bg-sky-600 text-white' },
}

/**
 * 移动版外壳：仅承载外业高频功能（督导任务 + 现场检查），
 * 与 Web 端共用同一 API 层（@/api）与检查项库（@/data/checklib）——配置变更两端同步生效。
 */
export default function MobileShell() {
  const { user, org, logout } = useAuth()
  const [tab, setTab] = useState<'tasks' | 'me'>('tasks')
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [reportTaskId, setReportTaskId] = useState<string | null>(null)
  if (!user) return null
  const rm = ROLE_META[user.role]

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-50">
      <header className="bg-teal-800 text-white px-3 py-2 flex items-center gap-2 shrink-0">
        <Accessibility className="w-5 h-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm leading-tight">无障碍督导系统 <span className="text-[10px] font-normal opacity-70">移动版</span></p>
          <p className="text-[10px] opacity-70 truncate">{org ? `${org.name} · ${org.regionName}` : '平台级账号'}</p>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto">
        {activeTaskId
          ? <MobileInspect taskId={activeTaskId} onExit={() => setActiveTaskId(null)} />
          : reportTaskId
            ? <TaskReport taskId={reportTaskId} onBack={() => setReportTaskId(null)} />
            : tab === 'tasks'
              ? <MobileTasks onStart={id => setActiveTaskId(id)} onViewReport={id => setReportTaskId(id)} />
              : (
              <div className="p-3 space-y-3">
                <Card>
                  <CardContent className="p-4 space-y-2 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      <UserRound className="w-4 h-4 text-teal-700" />{user.name}
                      <Badge className={rm.cls + ' text-[10px] px-1.5 py-0'}>{rm.label}</Badge>
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      {org ? <><Building2 className="w-3.5 h-3.5" />{org.name} · 督导区域：{org.regionName}</> : <><Globe className="w-3.5 h-3.5" />平台级账号（跨组织）</>}
                    </p>
                    <p className="text-xs text-slate-400">移动版当前支持：任务领取 / GPS 签到 / 现场核查 / 提交归档。地图点位、问题闭环、统计分析等请使用电脑版。</p>
                  </CardContent>
                </Card>
                <Button variant="outline" className="w-full h-10" onClick={() => { window.location.hash = '#/pc' }}>
                  <MonitorSmartphone className="w-4 h-4 mr-1" />切换到电脑版
                </Button>
                <Button variant="ghost" className="w-full h-10 text-slate-500"
                  onClick={() => { if (confirm('退出登录？')) logout() }}>
                  <LogOut className="w-4 h-4 mr-1" />退出登录
                </Button>
              </div>
            )}
      </main>

      {!activeTaskId && !reportTaskId && (
        <nav className="shrink-0 bg-white border-t grid grid-cols-2">
          <button onClick={() => setTab('tasks')}
            className={`py-2 flex flex-col items-center gap-0.5 text-[11px] ${tab === 'tasks' ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
            <ClipboardList className="w-5 h-5" />督导任务
          </button>
          <button onClick={() => setTab('me')}
            className={`py-2 flex flex-col items-center gap-0.5 text-[11px] ${tab === 'me' ? 'text-teal-700 font-semibold' : 'text-slate-400'}`}>
            <UserRound className="w-5 h-5" />我的
          </button>
        </nav>
      )}
    </div>
  )
}
