import { useState } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Accessibility, Loader2 } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { phone: '13900000000', name: '平台管理员', role: '平台管理员', org: '—' },
  { phone: '13800000001', name: '王敏', role: '组织管理员', org: '杭州市西湖区无障碍督导队' },
  { phone: '13800000002', name: '李强', role: '督导员', org: '杭州市西湖区无障碍督导队' },
  { phone: '13800000003', name: '陈芳', role: '组织管理员', org: '成都市锦江区无障碍督导站' },
  { phone: '13800000004', name: '赵磊', role: '督导员', org: '成都市锦江区无障碍督导站' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!phone.trim() || !password) { setErr('请输入手机号和密码'); return }
    setErr('')
    setBusy(true)
    try {
      await login(phone.trim(), password)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-teal-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center text-white space-y-1">
          <Accessibility className="w-10 h-10 mx-auto" />
          <h1 className="text-xl font-bold">无障碍督导系统</h1>
          <p className="text-xs opacity-70">依据 GB 55019-2021 / GB 50763-2012</p>
        </div>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">登录</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="space-y-1 block">
              <span className="text-xs text-slate-500">手机号</span>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="请输入手机号" inputMode="tel" autoFocus />
            </label>
            <label className="space-y-1 block">
              <span className="text-xs text-slate-500">密码</span>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码"
                onKeyDown={e => { if (e.key === 'Enter') void submit() }} />
            </label>
            {err && <p className="text-xs text-red-600">{err}</p>}
            <Button className="w-full" disabled={busy} onClick={() => void submit()}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}登 录
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-slate-500">演示账号（密码均为 123456，点击快速填充）</CardTitle></CardHeader>
          <CardContent className="p-2 pt-0">
            {DEMO_ACCOUNTS.map(a => (
              <button key={a.phone} onClick={() => { setPhone(a.phone); setPassword('123456'); setErr('') }}
                className="w-full text-left text-xs rounded px-2 py-1.5 hover:bg-teal-50 flex items-center gap-2">
                <span className="font-mono text-slate-500">{a.phone}</span>
                <span className="font-medium">{a.name}</span>
                <span className="text-teal-700">{a.role}</span>
                <span className="text-slate-400 truncate ml-auto">{a.org}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
