import { useState } from 'react'
import { toast } from 'sonner'
import { useSelfPatch } from '@/api/hooks'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** 个人中心：修改本人姓名/手机号、修改密码（旧密码校验），Web/移动版共用 */
export default function ProfileDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const selfPatch = useSelfPatch()
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const saveProfile = async () => {
    if (!name.trim()) { toast.error('姓名不能为空'); return }
    if (!/^1\d{10}$/.test(phone.trim())) { toast.error('手机号格式不正确'); return }
    try {
      await selfPatch.mutateAsync({
        ...(name.trim() !== user?.name && { name: name.trim() }),
        ...(phone.trim() !== user?.phone && { phone: phone.trim() }),
      })
      toast.success('资料已更新')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存失败')
    }
  }

  const changePassword = async () => {
    if (!oldPassword || !newPassword) { toast.error('请输入原密码与新密码'); return }
    if (newPassword.length < 6) { toast.error('新密码至少 6 位'); return }
    try {
      await selfPatch.mutateAsync({ oldPassword, newPassword })
      toast.success('密码已修改')
      setOldPassword(''); setNewPassword('')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '修改失败')
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle className="text-base">个人中心</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">基本资料</p>
            <label className="space-y-1 block"><span className="text-xs text-slate-500">姓名</span>
              <Input value={name} onChange={e => setName(e.target.value)} /></label>
            <label className="space-y-1 block"><span className="text-xs text-slate-500">手机号（登录账号）</span>
              <Input value={phone} onChange={e => setPhone(e.target.value)} /></label>
            <Button size="sm" className="w-full" disabled={selfPatch.isPending} onClick={() => void saveProfile()}>保存资料</Button>
          </div>
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-slate-600">修改密码</p>
            <Input type="password" placeholder="原密码" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
            <Input type="password" placeholder="新密码（至少 6 位）" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <Button size="sm" variant="outline" className="w-full" disabled={selfPatch.isPending} onClick={() => void changePassword()}>修改密码</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
