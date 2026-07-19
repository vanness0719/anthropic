# P3 · 销售-生产-交付协同跟踪系统

让**市场销售、生产计划、生产执行**三方在同一张表上协同:销售录入订单,生产按阶段跟踪
计划与实际进度,交付联动库存;谁录入、谁锁定、谁修改全程留痕。

> **两种运行模式,前端自动切换**:
> - **多人在线(服务器版)**:大家访问同一地址,实时看到同一份数据;账号+密码登录;
>   锁定/权限/日志由服务器权威裁决。数据存服务器(JSON 文件,可平滑换 SQLite)。
> - **单机(便携版)**:双击 `portable/p3.html` 即用,数据存本浏览器 localStorage,
>   顶栏可导出/导入 JSON 交换。
>
> 关键设计:业务逻辑(锁校验/字段级日志/库存联动/排期)抽成**纯函数 reducer**
> (`src/core/reducer.ts`),浏览器与服务器**跑同一份**,两模式行为完全一致。
> 前端启动探测 `/api/health`:连得上走服务器模式,否则单机模式。

## 功能

- **登录**:选择用户名进入(销售/生产计划/生产执行/管理员四种角色),所有操作以该身份记日志。
- **订单总表**:一行一订单——客户、型号、晶圆名称/版本、数量、单价、金额、要求交期、计划完成
  (晚于要求交期自动标"延期")、当前阶段、阶段一览色条、进度条、锁标记;支持搜索、列筛选、排序。
- **生产阶段**(订单详情内):晶圆制造 → CP1~CP4 → 基板生产 → 封装 → Burn-in → FT1~FT3 →
  库存出货 → 客户收货,每单可启用/停用个别阶段。
  - **自动排期**:按各阶段"周期(天)"自下单日期起链式计算计划起止;任一周期变更全链重算。
  - **手动日期**:特殊情况(如基板与晶圆并行)打开"手动日期"直接指定该阶段计划起止,
    后续阶段从手动日期继续推算。
  - 每阶段可填实际起止(自动算与计划的偏差天数)、状态(未开始/进行中/完成/异常)、
    投入/产出数量(自动算良率)、负责人、备注。
- **锁定/解锁**:销售信息区和每个阶段各一把锁。后一阶段人员核对后可锁定前面的数据,
  锁定后任何人(含录入人)不可修改,仅**锁定人或管理员**可解锁;被拒绝的修改也记日志。
- **库存**:各型号余额 = 期初 + 生产入库 + 调整 − 出货。最后一个生产阶段完成自动入库、
  "库存出货"完成自动出库;订单可填"库存抵扣数量",订单详情实时显示该型号当前库存。
- **汇总统计**:按客户×型号(数量/金额/客户合计)、按型号(总量/已交付/在产)、
  各阶段在制订单数;支持客户/型号/下单日期时间段筛选,多币种金额分开累计;
  可一键**导出 Excel**(.xlsx 多 sheet:说明/按客户/按型号/阶段在制/订单明细,随当前筛选生效)。
- **操作日志**:登录、新建、逐字段修改(前值→后值)、锁定/解锁、修改被拒、库存、导入等
  全部动作,可按用户/动作/关键字筛选。
- **设置**:各阶段默认周期(新建订单预填);管理员增删用户、分配角色。

## 运行

### 方式 A:多人在线(Docker 一键)⭐ 推荐给团队

需要一台大家都能访问的机器(内网服务器或云主机)装好 Docker,然后:

```bash
cd projects/p3
docker compose up -d --build      # 起服务;数据持久化到 ./p3-data/
```

浏览器访问 **http://<主机IP>:8080**。首次自动内置演示数据与 4 个演示账号:

| 用户名 | 角色 | 初始口令 |
|---|---|---|
| 张伟 | 销售 | `p3admin` |
| 李静 | 生产计划 | `p3admin` |
| 王强 | 生产执行 | `p3admin` |
| 管理员 | 管理员 | `p3admin` |

> ⚠️ 首次登录后请在「设置」页**修改密码**;管理员可新增用户、分配角色、重置密码。
> 改口令默认值:改 `docker-compose.yml` 的 `P3_DEFAULT_PASSWORD`(仅影响首次播种)。
> 数据在宿主机 `projects/p3/p3-data/p3-db.json`,备份/迁移直接拷该文件。

### 方式 B:多人在线(本机 Node,不用 Docker)

需装 Node 22+:

```bash
cd projects/p3
npm install
npm start        # 构建前端 + 起服务,默认 http://localhost:3000
# 自定义:PORT=8080 P3_DATA_FILE=./p3-data/p3-db.json npm run serve
```

### 方式 C:便携版单文件(免安装,双击即用,单机)

仓库内已提供打包好的单文件 **`portable/p3.html`** —— 下载后双击用浏览器打开即可
(推荐 Chrome/Edge),**无需服务器**。数据存本浏览器 localStorage,顶栏可导出/导入 JSON。
连不上后端时前端自动进入此单机模式。改动源码后重新生成:`npm run build:portable`。

### 开发(前后端热更新)

```bash
npm run dev:all  # 同时起 vite(5174,代理 /api) + 后端(tsx watch,3000)
npm run typecheck  # 前端 + 服务器类型检查
```

## 技术栈与目录

前端 Vite + React 18 + TypeScript + Ant Design 5 + Zustand;后端 Node + Express + bcryptjs(tsx 运行 TS)。

```
src/                          # 前端 + 前后端共享核心
├── types.ts                # 数据模型(User/Order/StageData/InventoryMove/LogEntry/Settings)
├── core/reducer.ts         # ★共享纯函数 applyAction:锁校验+字段级日志+库存联动(前后端同跑)
├── constants/{stages,schema}.ts
├── utils/{schedule,inventory,summary,id,excel}.ts
├── store/
│   ├── appStore.ts         # Zustand:双模式(server/local)统一入口,server 模式 ~4s 轮询
│   ├── api.ts              # 服务器模式 REST 客户端
│   ├── persist.ts          # localStorage 持久化 + JSON 导出/导入(单机)
│   └── seed.ts             # 演示种子数据
├── components/             # LoginGate / LockButton / StageStrip / StageTable / OrderDrawer
├── pages/                  # Orders / Inventory / Summary / Logs / Settings
└── App.tsx                 # 顶栏(模式标识)+ 菜单 + 页面切换

server/                       # 后端(仅服务器模式)
├── index.ts                # Express:health/login/state/action/users 端点 + 托管 dist
├── store.ts                # JSON 文件持久化(原子写)+ 去密码哈希
└── auth.ts                 # bcrypt 校验 + 内存会话 token

Dockerfile / docker-compose.yml   # 一键部署(数据存 /data 卷)
```

> 架构要点:所有变更只有一条权威路径 `applyAction`。单机模式在浏览器里跑它并存 localStorage;
> 服务器模式在 Node 里跑同一份并存 JSON 文件、由 token 定位操作者——**锁定与权限以服务器为准**,
> 前端界面只是提示。将来把 `server/store.ts` 换成 SQLite 即可,其余不动。
