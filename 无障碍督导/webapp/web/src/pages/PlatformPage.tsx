import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useCreateOrg, useCreateUser, useOrgs, useUpdateOrg, useUpdateUser, useUsers } from '@/api/hooks'
import type { Org } from '@/api/types'
import { Pager, usePager } from '@/components/Pager'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Building2, ChevronDown, ChevronRight, KeyRound, MapPin, Plus, UserRound } from 'lucide-react'
import regionsJson from '@/data/china-regions.json'

/** 全国行政区划（省 → 地级市 → 区县），含中心点与区域范围（GCJ-02，来源：DataV GeoAtlas） */
interface DistrictEntry { name: string; adcode: number; center: [number, number]; bounds: [[number, number], [number, number]] }
interface CityEntry extends DistrictEntry { districts: DistrictEntry[] }
interface ProvinceEntry { name: string; cities: CityEntry[] }
const REGIONS = regionsJson as ProvinceEntry[]

const selCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm'

export default function PlatformPage() {
  const { data: orgs = [], isLoading } = useOrgs()
  const orgsPg = usePager(orgs, 8)
  const createOrg = useCreateOrg()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', orgType: '', prov: '', city: '', district: '', adminName: '', adminPhone: '', adminPassword: '' })

  const prov = useMemo(() => REGIONS.find(p => p.name === form.prov), [form.prov])
  const city = useMemo(() => prov?.cities.find(c => c.name === form.city), [prov, form.city])
  const district = useMemo(() => city?.districts.find(d => d.name === form.district), [city, form.district])
  /** 选中的督导区域（区县优先，否则整个地级市） */
  const region = district ?? city
  const regionName = city ? (district ? `${city.name}${district.name}` : city.name) : ''

  const save = async () => {
    if (!form.name.trim() || !form.orgType.trim()) { toast.error('请填写组织名称与类型'); return }
    if (!region) { toast.error('请选择督导区域（地级市，可精确到区县）'); return }
    if (!form.adminName.trim() || !form.adminPhone.trim()) { toast.error('请填写组织管理员姓名与手机号（用于开通登录账号）'); return }
    if (!/^1\d{10}$/.test(form.adminPhone.trim())) { toast.error('管理员手机号格式不正确'); return }
    try {
      const { adminUser } = await createOrg.mutateAsync({
        name: form.name.trim(),
        orgType: form.orgType.trim(),
        regionName,
        center: region.center,
        bounds: region.bounds,
        adminName: form.adminName.trim(),
        adminPhone: form.adminPhone.trim(),
        ...(form.adminPassword.trim() && { adminPassword: form.adminPassword.trim() }),
      })
      toast.success(`组织已创建，管理员账号：${adminUser?.phone}（初始密码 ${form.adminPassword.trim() || '123456'}）`)
      setCreating(false)
      setForm({ name: '', orgType: '', prov: '', city: '', district: '', adminName: '', adminPhone: '', adminPassword: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '创建失败')
    }
  }

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-700" /> 平台管理
            <span className="text-xs font-normal text-slate-400">组织（租户）管理 · 共 {orgs.length} 个组织</span>
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant={creating ? 'secondary' : 'default'} onClick={() => setCreating(!creating)}>
              <Plus className="w-4 h-4 mr-1" />{creating ? '取消' : '新增组织'}
            </Button>
          </div>
        </div>

        {creating && (
          <Card className="border-teal-200 bg-teal-50/50">
            <CardHeader className="py-3"><CardTitle className="text-sm">新增组织</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Input className="w-64" placeholder="组织名称 *（如：广州市无障碍督导队）" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <Input className="w-48" placeholder="组织类型 *（如：残联督导队）" value={form.orgType} onChange={e => setForm({ ...form, orgType: e.target.value })} />
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <span className="text-xs text-slate-500">督导区域 *：</span>
                <select className={selCls} value={form.prov} onChange={e => setForm({ ...form, prov: e.target.value, city: '', district: '' })}>
                  <option value="">选择省份</option>
                  {REGIONS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <select className={selCls} value={form.city} disabled={!prov} onChange={e => setForm({ ...form, city: e.target.value, district: '' })}>
                  <option value="">选择地级市</option>
                  {prov?.cities.map(ci => <option key={ci.adcode} value={ci.name}>{ci.name}</option>)}
                </select>
                <select className={selCls} value={form.district} disabled={!city || city.districts.length === 0} onChange={e => setForm({ ...form, district: e.target.value })}>
                  <option value="">全市（不限区县）</option>
                  {city?.districts.map(d => <option key={d.adcode} value={d.name}>{d.name}</option>)}
                </select>
                {regionName && (
                  <span className="text-xs text-teal-700 bg-teal-100 rounded px-2 py-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{regionName}（中心点与区域范围由系统自动设定）
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap items-center border-t border-teal-100 pt-3">
                <span className="text-xs text-slate-500">首位组织管理员 *（开通登录账号）：</span>
                <Input className="w-40" placeholder="姓名" value={form.adminName} onChange={e => setForm({ ...form, adminName: e.target.value })} />
                <Input className="w-44" placeholder="手机号（登录账号）" value={form.adminPhone} onChange={e => setForm({ ...form, adminPhone: e.target.value })} />
                <Input className="w-44" placeholder="初始密码（默认 123456）" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} />
              </div>
              <Button size="sm" disabled={createOrg.isPending} onClick={() => void save()}>创建组织</Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {orgsPg.pageItems.map(o => (
            <OrgCard key={o.id} org={o} />
          ))}
          {!isLoading && orgs.length === 0 && <p className="text-sm text-slate-400">暂无组织</p>}
          <Pager page={orgsPg.page} totalPages={orgsPg.totalPages} total={orgsPg.total} onChange={orgsPg.setPage} />
        </div>
      </div>
    </div>
  )
}

/** 组织卡片：停用/启用 + 组织管理员管理（设置/修改/重置密码） */
function OrgCard({ org: o }: { org: Org }) {
  const updateOrg = useUpdateOrg()
  const [expanded, setExpanded] = useState(false)

  const toggleStatus = async () => {
    const to = o.status === 'disabled' ? 'active' : 'disabled'
    if (to === 'disabled' && !confirm(`停用「${o.name}」？停用后该组织所有账号将无法登录。`)) return
    try {
      await updateOrg.mutateAsync({ id: o.id, status: to })
      toast.success(to === 'disabled' ? '组织已停用' : '组织已启用')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  return (
    <Card className={o.status === 'disabled' ? 'opacity-70' : ''}>
      <CardContent className="py-3 px-4 space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{o.name}</span>
              <Badge variant="secondary" className="text-[11px]">{o.orgType}</Badge>
              {o.status === 'disabled'
                ? <Badge variant="outline" className="text-[11px] text-slate-400">已停用</Badge>
                : <Badge variant="outline" className="text-[11px] text-green-600 border-green-300">启用中</Badge>}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              督导区域：{o.regionName} · 中心 {o.center[0]}, {o.center[1]} · ID：{o.id}
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 h-8 text-xs" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="w-3.5 h-3.5 mr-1" /> : <ChevronRight className="w-3.5 h-3.5 mr-1" />}管理员管理
          </Button>
          <Button size="sm" variant={o.status === 'disabled' ? 'default' : 'outline'} className="shrink-0 h-8 text-xs"
            disabled={updateOrg.isPending} onClick={() => void toggleStatus()}>
            {o.status === 'disabled' ? '启用组织' : '停用组织'}
          </Button>
        </div>
        {expanded && <OrgAdminPanel org={o} />}
      </CardContent>
    </Card>
  )
}

/** 组织管理员管理面板：成员列表（设为/取消管理员、停用/启用、重置密码）+ 新增管理员 */
function OrgAdminPanel({ org }: { org: Org }) {
  const { data: users = [] } = useUsers(org.id)
  const updateUser = useUpdateUser()
  const createUser = useCreateUser()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', password: '' })

  const act = async (body: Parameters<typeof updateUser.mutateAsync>[0], okMsg: string) => {
    try {
      await updateUser.mutateAsync(body)
      toast.success(okMsg)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败')
    }
  }

  const addAdmin = async () => {
    if (!form.name.trim() || !/^1\d{10}$/.test(form.phone.trim())) { toast.error('请填写姓名与正确的手机号'); return }
    try {
      await createUser.mutateAsync({ name: form.name.trim(), phone: form.phone.trim(), role: 'admin', orgId: org.id, ...(form.password.trim() && { password: form.password.trim() }) })
      toast.success(`管理员已添加（初始密码 ${form.password.trim() || '123456'}）`)
      setAdding(false)
      setForm({ name: '', phone: '', password: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '添加失败')
    }
  }

  return (
    <div className="border-t pt-2 space-y-1.5">
      <p className="text-xs font-medium text-slate-600 flex items-center gap-1"><UserRound className="w-3.5 h-3.5" />组织成员（{users.length}）</p>
      {users.map(u => (
        <div key={u.id} className="flex items-center gap-2 text-xs border rounded px-2 py-1.5 bg-white flex-wrap">
          <span className="font-medium">{u.name}</span>
          <span className="font-mono text-slate-400">{u.phone}</span>
          <Badge variant="secondary" className="text-[10px]">{u.role === 'admin' ? '管理员' : '督导员'}</Badge>
          {u.status === 'disabled' && <Badge variant="outline" className="text-[10px] text-slate-400">已停用</Badge>}
          <span className="flex-1" />
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
            onClick={() => void act({ id: u.id, role: u.role === 'admin' ? 'inspector' : 'admin' }, u.role === 'admin' ? '已降为督导员' : '已设为管理员')}>
            {u.role === 'admin' ? '降为督导员' : '设为管理员'}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
            onClick={() => { if (confirm(`将 ${u.name} 的密码重置为 123456？`)) void act({ id: u.id, password: '123456' }, '密码已重置为 123456') }}>
            <KeyRound className="w-3 h-3 mr-0.5" />重置密码
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2"
            onClick={() => void act({ id: u.id, status: u.status === 'active' ? 'disabled' : 'active' }, u.status === 'active' ? '账号已停用' : '账号已启用')}>
            {u.status === 'active' ? '停用' : '启用'}
          </Button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-2 flex-wrap border border-teal-200 rounded px-2 py-2 bg-teal-50/50">
          <Input className="w-32 h-8 text-xs" placeholder="姓名 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input className="w-40 h-8 text-xs" placeholder="手机号（登录账号）*" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input className="w-36 h-8 text-xs" placeholder="初始密码（默认123456）" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <Button size="sm" className="h-8 text-xs" disabled={createUser.isPending} onClick={() => void addAdmin()}>确认添加</Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAdding(false)}>取消</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />新增管理员
        </Button>
      )}
    </div>
  )
}
