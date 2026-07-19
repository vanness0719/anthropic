# P3 服务器版镜像:构建前端 → 用 Node 同时提供页面与 API(数据存 /data 卷)。
# ---- 构建阶段:编译前端 ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build   # tsc 类型检查 + vite 构建 → dist/

# ---- 运行阶段:安装依赖并用 tsx 跑服务器 ----
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm i tsx@^4
# 拷贝构建产物、服务器与共享源码
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY src ./src
COPY tsconfig.json ./
ENV PORT=3000
ENV P3_DATA_FILE=/data/p3-db.json
VOLUME ["/data"]
EXPOSE 3000
CMD ["npx", "tsx", "server/index.ts"]
