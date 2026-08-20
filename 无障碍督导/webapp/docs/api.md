# 无障碍督导系统 Web 正式版 — API 契约（V1.0）

> 本文档是前后端开发的**唯一接口契约**。Base URL：`/api`。除登录外全部接口需 `Authorization: Bearer <token>`。
> 错误格式：NestJS 标准 `{ statusCode, message, error? }`；业务校验失败用 422 并附 `message`（中文，可直接展示）。

## 0. 通用约定

- ID：字符串，服务端生成格式 `${prefix}-${6位随机}`；种子数据保留原型 ID（如 `org-hz`、`p1`）。
- 时间：ISO 8601 字符串（`new Date().toISOString()`），前端负责格式化显示。
- 地理：`lat/lng` 为 number；`center: [lat, lng]`；`bounds: [[minLat, minLng], [maxLat, maxLng]]`。
- 角色 `role`：`platform_admin`（平台管理员） | `admin`（组织管理员） | `inspector`（督导员）。
- **租户隔离**：除标注 `platform_admin` 的接口外，所有查询/写入强制限定在 token 携带的 `orgId` 内；跨组织访问返回 404（与不存在一致）。
- 检查项库版本：`checklibVersion = "1.4"`。
- **检查项配置版本**：`GET /check-profiles` 列表（meta）、`GET /check-profiles/:id` 详情（含完整 `payload`：设施/矩阵/明细/检查点模板/参数补丁/参数速查）。内置默认配置 `prof-quick`（"督导员快速检查表"）。行动创建时以 `profileId` 选用（缺省默认配置，不存在 422）；现场核查表按行动配置生成，检查记录保存 `profileId` 以便溯源。
- **分页约定（预留）**：一期列表接口返回组织内全量数据，前端统一客户端分页（组件 `web/src/components/Pager.tsx`）；后续数据量增长时列表接口以 `?page=&pageSize=` 扩展为服务端分页，响应包 `{items, total, page, pageSize}`，前端分页组件接口不变。

## 1. 认证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | /auth/login | 免鉴权。body `{phone, password}` → `{token, user, org}`（org 为 null 当 platform_admin） |
| GET | /auth/me | → `{user, org}` |

种子账号（密码均 `123456`）：

| 手机 | 姓名 | 角色 | 组织 |
| --- | --- | --- | --- |
| 13900000000 | 平台管理员 | platform_admin | — |
| 13800000001 | 王敏 | admin | org-hz 杭州市西湖区无障碍督导队 |
| 13800000002 | 李强 | inspector | org-hz |
| 13800000003 | 陈芳 | admin | org-cd 成都市锦江区无障碍督导站 |
| 13800000004 | 赵磊 | inspector | org-cd |

## 2. DTO（与原型类型一致）

```ts
type Role = 'platform_admin' | 'admin' | 'inspector'
interface User { id; orgId: string | null; name; phone; role: Role; status: 'active'|'disabled'; certNo?: string; certExpiresAt?: string }
interface Org { id; name; orgType; regionName; center: [number,number]; bounds: [[number,number],[number,number]]; status: 'active'|'disabled'; expiresAt?: string }
interface Campaign { id; orgId; name; regionDesc; bounds: [[number,number],[number,number]] | null; createdBy; createdAt; status: 'active'|'done' }
type PointStatus = 'pending'|'inspecting'|'issue'|'recheck'|'closed'|'blocked'
interface Point { id; orgId; campaignId; kind: 'building'|'road'; name; address; lat; lng; lat2?; lng2?; subtypeId; nature; owner; contact; status: PointStatus; locked: boolean; createdBy; createdAt; updatedAt; changeLog: {at;by;field;from;to;reason}[] }
type TaskStatus = 'pool'|'todo'|'doing'|'done'|'blocked'
interface Task { id; orgId; pointId; title; deadline; mode: 'pool'|'assign'; assigneeId?: string; status: TaskStatus; createdAt; claimedAt?; startedAt?; finishedAt?; startLat?; startLng?; startDistance? }
type IssueStatus = 'open'|'deferred'|'assigned'|'fixing'|'recheck'|'closed'
interface IssueHistory { at; action; by; note? }
interface Issue { id; orgId; pointId; inspectionId?: string; facility; title; requirement; clause; severity: 'M'|'C'|'R'; desc; photos: string[] /*fileId*/; status: IssueStatus; history: IssueHistory[]; responsible; deadline; createdAt; updatedAt }
interface AspectResult { measured?: string; verdict?: 'pass'|'fail' }
interface InstanceResult { id; facility; no: number; locationDesc; applicable?: boolean; checks: Record<string, AspectResult>; note?: string; photos?: string[] /*fileId*/ }
interface MainInfo { floors; nature; contact; contactPhone; collectStatus; note; photos: string[] /*建筑现场照片 fileId*/ }
interface Inspection { id; orgId; taskId; pointId; inspectorId; inspectorName; mainInfo: MainInfo; instances: InstanceResult[]; condTriggered?: string[]; checklibVersion; submittedAt }
interface FileMeta { id; orgId; filename; mime; size; uploadedBy; createdAt }
```

## 3. 业务接口

### 组织 /orgs
- `GET /orgs` — platform_admin 返回全部；其余返回本组织（数组，1 条）。
- `POST /orgs`（platform_admin）body `{name, orgType, regionName, center, bounds, expiresAt?, adminName?, adminPhone?, adminPassword?}`。同时提供 `adminName + adminPhone` 时**原子开通首位组织管理员账号**（role=admin，初始密码默认 `123456`，手机号重复 422）；返回 `{org, adminUser}`（未提供管理员时 adminUser 为 null）。
- `PATCH /orgs/:id`（platform_admin）部分更新（含区域调整）。

### 用户 /users
- `GET /users` — 本组织用户列表（platform_admin 可 `?orgId=`）。
- `POST /users`（admin/platform_admin）body `{name, phone, role: 'admin'|'inspector', password?}`，默认密码 `123456`；phone 唯一，重复 422。
- `PATCH /users/:id`（admin）body 子集 `{name, role, status, certNo, certExpiresAt, password}`。

### 督导行动 /campaigns
- `GET /campaigns`
- `POST /campaigns`（admin）body `{name, regionDesc?, bounds?}`。**大致范围 bounds 可选**（不划定 = 整个组织区域）；划定时 bounds 必须在组织区域内（422）。
- `PATCH /campaigns/:id`（admin）body `{status}`。

### 点位 /points
- `GET /points`（可 `?campaignId=`）
- `POST /points`（admin）body 除 id/orgId/status/locked/changeLog 外的 Point 字段（`address` 可选）。校验：坐标在组织区域内（422 `点位超出组织督导区域`，**硬性**）；**超出行动划定范围不禁止，仅由前端提醒确认**；道路类必须含 lat2/lng2。初始 `status='pending', locked=true`。校验失败提示均为中文。可选 `publishTask: true` + `taskTitle?/taskDeadline?`：**建点同时发布任务池督导任务**（标题缺省 `点位名+无障碍督导`，时限缺省 14 天后），返回 `{...point, publishedTask}`。
- `PATCH /points/:id`（admin）允许修改 `name/address/lat/lng/lat2/lng2/subtypeId/nature/owner/contact/status`；位置与类别变更自动追加 changeLog（body 可带 `reason`）。
- `GET /points/:id` → `{point, tasks, issues, inspections}`（该点位关联数据，org 内）。

### 任务 /tasks
- `GET /tasks`
- `POST /tasks`（admin）body `{pointId, title, deadline, mode, assigneeId?}`。校验：该点位无 pool/todo/doing 状态任务（422 `该点位已有进行中的督导任务`）；mode=assign 时 assigneeId 必填且 status 直接为 `todo`；mode=pool → `pool`。
- `POST /tasks/:id/claim`（inspector/admin）pool → todo，assigneeId=当前用户。非 pool 状态 422。
- `POST /tasks/:id/start`（领取人本人）todo → doing；同时点位 → `inspecting`。body 可带 `{lat, lng, force?}`：若提供坐标且距点位 > 200m，返回 422 `{message: '您距点位约 Xm，超出签到允许范围(200m)', distance}`，前端确认后带 `force:true` 重试（服务端记录 startDistance）。
- `POST /tasks/:id/release`（领取人）doing → todo（暂存退出；点位保持 inspecting，与原型一致）。
- `POST /tasks/:id/return`（admin）done/blocked → doing（退回编辑状态，督导员可重新进入补充核查并再次提交；同时点位 → `inspecting`，finishedAt 清空）。
- `GET /tasks/:id` → `{task, point, inspections, issues, log}`：该任务的检查记录（督导报告数据源）、按 inspectionId 关联的问题单、以及任务日志时间线 `log: [{at, event, by?}]`（创建 → 领取 → 现场签到 → 每次提交检查 → 结办 → 问题全部闭环销号；并合并**管理员退回补充**（持久化于 `task.log`）与**关联问题单流转记录**（审核立案/派单/整改反馈/申请复查/复查通过/退回整改），按时间排序）。

### 检查记录 /inspections
- `POST /inspections`（inspector/admin）body `{taskId, mainInfo, instances, condTriggered?}`。
  服务端逻辑（**与原型 submit() 完全一致**）：
  1. 校验任务属本组织、状态 todo/doing；
  2. `blocked = mainInfo.collectStatus !== 'ok'`；
  3. 非 blocked 时用服务端 checklib `buildFacilityRows(point.subtypeId)` 计算（**重新督导提交时：本任务以往检查生成且未闭环的问题单全部删除并按最新结果重新生成——即"未闭环的全部更新"；已闭环的问题单原样保留**；更新事件写入 `task.log`）：
     - 缺失：instances 中数量为 0 的设施行 → 问题单（标题 `缺少必须设置的X`/`缺少条件设置的X`，severity M/C，history action `现场检查发现（设施缺失），自动生成问题单`）。**立案规则（V1.2）：level='M' 必须项全部立案；level='C' 条件项仅当包含在 `condTriggered`（督导员现场确认触发条件已满足的设施 id 列表）中才立案，未确认的条件项不生成问题单；level='R' 推荐项不立案**；
     - 不合格：applicable===true 的实例中 verdict==='fail' 的检查点 → 问题单（severity=item.level 含 R，标题 `${设施名}·${检查点}不符合（位置|实例N）`）；**任意设施实例均可现场增补自定义条款 `instance.customItems[{key, aspect, requirement}]`，与模板检查点合并判定；自定义条款不合格一律按"建议改进"（severity R）生成问题单（条款标注"督导员现场补充条款"）**；
  
  > 交互约定（V1.5）：督导员添加设施实例即代表"现场设有该设施"，实例默认 `applicable=true` 直接进入逐项核查；现场未设置的设施不添加实例，按"缺失"处理。实例可勾选"本处不涉及该服务设施"（`applicable=false`）：无需逐项评测、不作为缺失、其检查点 fail 也不生成问题单（服务端跳过），用于该场所客观上不涉及的服务设施（可拍照/备注说明）。
  4. 落库 inspection（checklibVersion='1.4'，含 condTriggered 确认结果）+ 批量问题单（status='open'）；
  5. 联动：blocked → 任务 `blocked`、点位 `blocked`；否则任务 `done`，点位 = 有问题单 `issue` / 无 `closed`；
  6. 返回 `{inspection, issues}`。
- `GET /inspections?pointId=` 列表；`GET /inspections/:id` 详情（只读）。

### 问题单 /issues
- `GET /issues`（可 `?status=&pointId=`）
- `POST /issues`（手动创建，inspector/admin）body `{pointId, facility, title, requirement, clause, severity, desc, photos?}` → status='open'，history 首条 `手动登记问题`；点位若非 closed/blocked 则置 `issue`。
- `POST /issues/:id/advance` body `{action?, note?, photos?}` 状态机（action 文案服务端默认、可被覆盖）：

  | 当前 → 下一 | 角色 | 默认 action 文案 |
  | --- | --- | --- |
  | open → assigned | admin | 审核立案并派单（body 可带 responsible/deadline 写入问题单） |
  | open → deferred | admin | 暂不立案（**note 补充说明必填**，缺省 422） |
  | deferred → assigned | admin | 审核立案并派单（补立案，可带 responsible/deadline） |
  | assigned → fixing | admin/inspector | 整改反馈（note/photos 追加） |
  | fixing → recheck | admin/inspector | 整改完成，申请复查 |
  | recheck → closed | admin/inspector | 复查通过，闭环销号 |
  | recheck → fixing | admin/inspector | 复查不通过，退回整改 |

  history 追加 `{at, action, by: 当前用户姓名, note}`；photos 追加到问题单 photos。
  点位联动（与原型一致）：→closed 时该点位无其他未闭环问题单（不含 deferred）→ 点位 `closed`；→recheck → 点位 `recheck`；→fixing（退回）→ 点位 `issue`。
  deferred（暂不立案）不计入"待闭环"统计、点位达标判定与整改落实指标。

### 文件 /files
- `POST /files/presign` body `{filename, mime, size}` → `{file: FileMeta, uploadUrl}`。
  - local 驱动：`uploadUrl = /api/files/{id}/content`，前端 `PUT`（Content-Type=原始 mime，body=二进制，带 Authorization）。
  - s3 驱动（docker 部署）：uploadUrl 为 MinIO 预签名 PUT。
- `GET /files/:id` — 流式返回文件（鉴权：Header 或 `?token=`，供 `<img>` 使用）；校验 org 归属。
- 限制：mime 仅 image/* 与 video/*；size ≤ 20MB（422）。

### 检查项库 /checklib
- `GET /checklib` → `{version, facilities, generic, groups, subtypes, matrix, details, aspects, extras, extraLevels, paramPatch, paramTable}`（服务端 checklib.ts 直接序列化，平台级只读）。

### 统计 /stats
- `GET /stats/overview`（org 内；platform_admin 传 `?orgId=` 或缺省=全局脱敏汇总）→
```json
{ "pointsTotal": 12, "inspectedPoints": 4, "issuesTotal": 3, "issuesClosed": 1,
  "pointsByStatus": [{"status":"pending","count":7}],
  "issuesByStatus": [{"status":"fixing","count":1}],
  "issuesByFacility": [{"facility":"parking","count":1}],
  "starPoints": [{"id":"p1","name":"...","status":"issue","subtypeId":"gov"}] }
```
（inspectedPoints = status ∈ inspecting/issue/recheck/closed/blocked 的点位数；starPoints = subtypeId 属于★重点分类的点位，全量返回，前端自展示。）

### 管理 /admin
- `POST /admin/reseed`（platform_admin）清空全部业务数据并重新种子化 → `{ok: true}`。
- 服务启动时若 `orgs` 表为空自动执行种子（与 reseed 同逻辑）。

## 4. 种子数据

**完全复刻原型** `src/store/app.tsx` 的 seed：2 组织、4 用户（加上 platform_admin 共 5）、3 行动、12 点位、7 任务、3 问题单（history 原样）。种子用户的 `passwordHash` 为 `123456` 的 bcrypt。

## 5. 非功能约定

- 服务端：NestJS 11 + TypeORM 0.3；`DB_TYPE=sqlite`（better-sqlite3，本地开发默认）或 `postgres`（pg，docker）；JSON 字段一律 `simple-json`；经纬度 `float`；时间 `text`(ISO)。
- 全局前缀 `/api`；全局 ValidationPipe（whitelist）；CORS 全开放（开发期）。
- JWT：payload `{sub, orgId, role, name}`，有效期 7d，secret 取 `JWT_SECRET`（默认开发值 `dev-secret`）。
- 前端：React Query 管理服务端状态；检查项库沿用前端本地 `src/data/checklib.ts`（与服务端副本同源）；现场督导草稿 localStorage 自动保存（key `wza-draft-{taskId}`），提交成功后清除。
