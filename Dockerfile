# ---- 构建阶段:用 Node 编译打包 ----
FROM node:22-alpine AS builder
WORKDIR /app

# 先拷依赖清单并安装(利用 Docker 层缓存)
COPY package.json package-lock.json ./
RUN npm ci

# 拷源码并构建(tsc 类型检查 + vite 生产构建)
COPY . .
RUN npm run build

# ---- 运行阶段:用 nginx 提供静态文件 ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
