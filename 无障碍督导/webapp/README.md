# 全国无障碍督导系统（Web 正式版）

基于地理位置的多租户无障碍督导平台。由 **Web 管理端/督导端**（React）+ **服务端**（NestJS）构成，检查项库依据 GB 55019-2021 / GB 50763-2012《各类建筑无障碍设施配置清单》结构化内置。

> 需求文档见 `../无障碍督导系统-开发需求文档.md`；前后端接口契约见 `docs/api.md`（唯一标准）。

## 目录结构

```
webapp/
├── docs/api.md          # API 契约（前后端共同遵循）
├── server/              # NestJS + TypeORM 后端（SQLite/PostgreSQL 双驱动）
├── web/                 # React 19 + Vite + Leaflet 前端（由原 app 原型改造）
├── docker-compose.yml   # 一键全栈部署（PostGIS + MinIO + server + web）
└── .env.example         # 全部环境变量及默认值
```

## 本地开发（零依赖：SQLite + 本地磁盘存储，无需 Docker）

```bash
# 终端 1：后端（默认 3000 端口；被占用时用 PORT=3100）
cd server && npm install && npm run build && node dist/main.js
# 首次启动自动建库（../data/dudao.db）并写入演示种子数据

# 终端 2：前端（vite 代理 /api → localhost:3000；后端非 3000 时设 API_PROXY_TARGET）
cd web && npm install && npm run dev        # http://localhost:5173
```

后端冒烟测试（79 项断言：认证/租户隔离/点位/任务/检查提交/问题闭环/文件/统计/重置）：

```bash
node scripts/smoke.mjs        # 需服务已启动；SMOKE_BASE 可指定其他地址
```

## 演示账号（密码均 `123456`）

| 手机 | 姓名 | 角色 | 组织 |
| --- | --- | --- | --- |
| 13900000000 | 平台管理员 | platform_admin | —（跨组织脱敏统计、组织开户、重置演示数据） |
| 13800000001 | 王敏 | 组织管理员 | 杭州市西湖区无障碍督导队 |
| 13800000002 | 李强 | 督导员 | 同上 |
| 13800000003 | 陈芳 | 组织管理员 | 成都市锦江区无障碍督导站 |
| 13800000004 | 赵磊 | 督导员 | 同上 |

## Docker 全栈部署

```bash
docker compose up --build
# web: http://localhost:8080   api: http://localhost:3000/api   minio 控制台: :9001
```

compose 编排：PostGIS（点位/区域）+ MinIO（照片影像，按组织前缀隔离）+ server + web(nginx)。
docker 模式自动切换 `DB_TYPE=postgres`、`STORAGE_DRIVER=s3`（MinIO 预签名上传）；本地开发默认 `sqlite + local`。

## 已实现功能（一期 P0 核心闭环）

- **多租户**：组织/督导区域授权，全部数据按 org_id 强制隔离（跨组织访问返回 404），组织内协同共享；平台管理员组织开户与全局脱敏统计。
- **用户权限**：平台管理员 / 组织管理员 / 督导员三角色，JWT 认证，组织内用户管理。
- **GIS 点位**：天地图底图，督导行动框选区域，建筑点位/道路线段建档（位置与类别锁定、变更留痕），区域越界服务端拒绝。
- **检查项库**：14 类设施 × 30 个建筑分类配置矩阵、约 160 条类型级要求、55+ 检查点模板、30 项参数速查（与原型 checklib 同源，服务端副本用于提交时问题单自动生成）。
- **督导任务**：任务池领取 / 指派双模式，GPS 签到（200m 容差，可强制并记录偏差），状态机流转。
- **现场检查**：四步向导（主体信息→设施实例→逐项核查→汇总提交），数值实测自动判定 + 人工判定双轨，设施实例动态增减，照片真上传（本地磁盘/MinIO），草稿 localStorage 自动保存，JSON/CSV/打印导出。
- **问题闭环**：缺失设施与不合格项自动生成问题单 → 立案派单 → 整改反馈 → 复查销号（含退回），全状态机角色校验，点位状态自动联动。
- **统计分析**：覆盖率、问题分布、销号率、★重点配置对象台账（服务端聚合）。
- **移动版（督导任务/现场检查）**：`web/src/mobile/`，屏幕宽度 <768px 自动启用，或 `#/m` 强制移动版 / `#/pc` 强制电脑版。与 Web 端共用同一 API 层（`@/api`）与检查项库（`@/data/checklib`），草稿同键（`wza-draft-{taskId}`）可跨端续填；接口/检查项配置变更两端同步生效，无需单独维护。

## 一期边界（需求文档中暂未实现项）

离线作业（FR-6.6 仅实现草稿自动保存与提交重试）、照片水印、整改责任单位独立账号（一期由督导员代录反馈）、消息推送/短信、规则库版本化在线更新、检查项库后台可视化维护（当前为平台只读共享库）。这些列入二期，接口已预留扩展空间。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + Vite 7 + TypeScript + Tailwind + shadcn/ui + React Query + Leaflet（天地图） |
| 后端 | NestJS 11 + TypeORM 0.3 + JWT(bcrypt) + class-validator |
| 数据库 | 开发：SQLite(better-sqlite3)；部署：PostgreSQL 16 + PostGIS（实体双库兼容：simple-json/float/text-ISO） |
| 存储 | 开发：本地磁盘；部署：MinIO(S3 预签名)，按组织前缀隔离 |
