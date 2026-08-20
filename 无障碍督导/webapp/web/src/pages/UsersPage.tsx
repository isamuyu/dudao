import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateUser, useUpdateUser, useUsers } from '@/api/hooks'
import { Pager, usePager } from '@/components/Pager'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Users } from 'lucide-react'

const ROLE_LABEL: Record<string, string> = { admin: '组织管理员', inspector: '督导员', platform_admin: '平台管理员' }
const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

export default function UsersPage() {
  const { user: me } = useAuth()
  const { data: users = [], isLoading } = useUsers()
  const usersPg = usePager(users, 8)
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', role: 'inspector' as 'admin' | 'inspector' })

  const save = async () => {
    if (!form.name.trim() || !form.phone.trim()) { toast.error('请填写姓名和手机号'); return }
    try {
      await createUser.mutateAsync({ name: form.name.trim(), phone: form.phone.trim(), role: form.role })
      toast.success('用户已创建（默认密码 123456）')
      setCreating(false)
      setForm({ name: '', phone: '', role: 'inspector' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    }
  }

  const toggle = async (id: string, status: 'active' | 'disabled') => {
    try {
      await updateUser.mutateAsync({ id, status })
      toast.success(status === 'active' ? '已启用' : '已停用')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  const resetPassword = async (id: string, name: string) => {
    if (!confirm(`将 ${name} 的密码重置为 123456？`)) return
    try {
      await updateUser.mutateAsync({ id, password: '123456' })
      toast.success('密码已重置为 123456')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-teal-700" /> 用户管理
            <span className="text-xs font-normal text-slate-400">本组织用户 · 新用户默认密码 123456</span>
          </h2>
          <Button size="sm" variant={creating ? 'secondary' : 'default'} onClick={() => setCreating(!creating)}>
            <Plus className="w-4 h-4 mr-1" />{creating ? '取消' : '新增用户'}
          </Button>
        </div>

        {creating && (
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="py-4 px-4 flex gap-2 flex-wrap items-center text-sm">
              <Input className="w-40" placeholder="姓名 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <Input className="w-44" placeholder="手机号 *" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <select className={selCls} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'inspector' })}>
                <option value="inspector">督导员</option>
                <option value="admin">组织管理员</option>
              </select>
              <Button size="sm" disabled={createUser.isPending} onClick={() => void save()}>创建</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-100/60 text-xs text-slate-500">
                  <th className="text-left px-4 py-2.5">姓名</th>
                  <th className="text-left px-4 py-2.5">手机号</th>
                  <th className="text-left px-4 py-2.5">角色</th>
                  <th className="text-left px-4 py-2.5">状态</th>
                  <th className="text-right px-4 py-2.5">操作</th>
                </tr>
              </thead>
              <tbody>
                {usersPg.pageItems.map(u => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 font-medium">{u.name}{u.id === me?.id && <span className="text-xs text-teal-600">（我）</span>}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{u.phone}</td>
                    <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[11px]">{ROLE_LABEL[u.role] ?? u.role}</Badge></td>
                    <td className="px-4 py-2.5">
                      {u.status === 'active'
                        ? <span className="text-xs text-green-600">启用中</span>
                        : <span className="text-xs text-slate-400">已停用</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right space-x-1.5">
                      {u.id !== me?.id && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={updateUser.isPending} onClick={() => void resetPassword(u.id, u.name)}>重置密码</Button>
                          {u.status === 'active'
                            ? <Button size="sm" variant="outline" className="h-7 text-xs" disabled={updateUser.isPending} onClick={() => void toggle(u.id, 'disabled')}>停用</Button>
                            : <Button size="sm" variant="outline" className="h-7 text-xs" disabled={updateUser.isPending} onClick={() => void toggle(u.id, 'active')}>启用</Button>}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {!isLoading && users.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">暂无用户</td></tr>
                )}
              </tbody>
            </table>
            <div className="px-4 pb-2">
              <Pager page={usersPg.page} totalPages={usersPg.totalPages} total={usersPg.total} onChange={usersPg.setPage} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
