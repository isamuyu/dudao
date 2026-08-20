# 无障碍督导系统 Web 前端

## 技术栈

React 19 + Vite 7 + TypeScript + Tailwind CSS + shadcn/ui + Leaflet（天地图底图）+ TanStack Query。

## 本地开发

```bash
npm install
npm run dev
```

需后端服务运行在 `http://localhost:3000`（`/api` 由 Vite dev proxy 转发）。接口契约见 `../docs/api.md`。

## 演示账号（密码均为 123456）

| 手机 | 姓名 | 角色 | 组织 |
| --- | --- | --- | --- |
| 13900000000 | 平台管理员 | platform_admin | — |
| 13800000001 | 王敏 | admin | 杭州市西湖区无障碍督导队 |
| 13800000002 | 李强 | inspector | 杭州市西湖区无障碍督导队 |
| 13800000003 | 陈芳 | admin | 成都市锦江区无障碍督导站 |
| 13800000004 | 赵磊 | inspector | 成都市锦江区无障碍督导站 |

## 构建

```bash
npm run build   # tsc -b && vite build，产物在 dist/
```

## Docker

```bash
docker build -t dudao-web .
docker run -p 8080:80 dudao-web
```

nginx 托管静态资源，`/api/` 反向代理至后端容器 `http://server:3000`，SPA 路由 fallback 到 `index.html`。
