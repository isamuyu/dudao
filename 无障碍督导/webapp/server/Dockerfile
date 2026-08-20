# 全国无障碍督导系统 - 后端服务
# 构建：docker build -t dudao-server .
# 运行（postgres + MinIO 时经环境变量切换驱动，见 ../.env.example）
FROM node:24-alpine

WORKDIR /app

# 容错 better-sqlite3 可选编译（optionalDependencies，失败不影响 postgres 部署）
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
