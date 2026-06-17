# DE-YMS · CP Single Product · Yield/Bin Pareto

依据《YMS 操作手册》(DataExp-YMS 半导体良率管理系统)实现的 **CP → Single Product →
Yield/Bin Pareto** 页面。这是良率工程师分析单产品 CP(Circuit Probe)测试结果的核心界面,
通过**良率趋势 + Bin 帕累托 + 晶圆图(wafermap)三者联动**定位失效 Bin、对比基线、查看空间分布。

> 这是整套 YMS(含 CP/WAT/Defect/WIP 50+ 模块)的首个落地页面;目录结构、数据模型、图表组件、
> 状态管理均按可扩展到全系统的原则设计。

## 技术栈

- **Vite + React 18 + TypeScript**
- **Ant Design 5** — 表格 / 选项卡 / 顶部菜单等 UI
- **ECharts** (`echarts-for-react`) — 趋势线、帕累托条形图、CDF
- **自研 `<WaferMap>` Canvas 组件** — 圆形裁剪的 die 网格热图,支持叠加(stacked)与 bin 高亮
- **Zustand** — 跨组件联动状态(趋势选点 ↔ 帕累托 ↔ 晶圆图)
- **内置 mock 数据生成器**(`src/mock/generateMockData.ts`)— 暂无真实晶圆数据时使用

## 功能

- 顶部 KPI 栏:Avg.Yield(含环比)、#Lot/Wafers/Scrap、Top Fail Bin、Wafer Edge / Non-Edge Yield
- Yield Trend 趋势图(Line Chart),Smart Split(Day/Week/Month)切换 X 轴聚合粒度
- **趋势图框选 wafer → 与 Baseline 对比**(保留最近 2 片,联动到 Selected 晶圆图)
- Bin Pareto 表(HBin/SBin/SBinGroup),按 Bin% 降序;点击行 → 高亮晶圆图对应 bin
- Bin Pareto 条形图 + CDF Plot
- Stacked wafermap(Baseline vs Selected),按 Yield 或 Bin 上色
- 右键晶圆图弹出上下文菜单(Overlay/Export/Maximize 等;Overlay 类为占位)

### 待实现(占位)

Box Plot / Bin Trend 选项卡内容、Overlay 真实数据叠加、真实后端接入、其余 CP 子模块。

## 运行

### 方式 A:Docker(推荐,无需本机装 Node)

```bash
docker compose up --build
```

构建完成后浏览器打开 **http://localhost:5173/** 即可。停止:`Ctrl + C`,或 `docker compose down`。

> 原理:多阶段构建 —— 先用 `node:22-alpine` 执行 `npm ci && npm run build`,再用 `nginx:alpine`
> 提供 `dist/` 静态文件;容器内 80 端口映射到宿主机 5173。

### 方式 B:本机 Node(开发,带热更新)

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 类型检查 + 生产构建
```

## 目录

```
src/
├── types/cp.ts                 # 数据模型(Bin/Die/Wafer/Product/ParetoRow)
├── mock/generateMockData.ts    # 确定性 mock 数据生成
├── utils/yieldCalc.ts          # 帕累托/良率/晶圆图叠加/趋势聚合
├── store/cpStore.ts            # Zustand 联动状态
├── components/
│   ├── layout/                 # TopMenu, SideMenu
│   ├── KpiBar.tsx
│   ├── trend/                  # YieldTrendPanel, TrendChart, SmartSplitControl
│   ├── pareto/                 # BinParetoPanel, BinParetoTable, ParetoBar, CdfChart
│   └── wafermap/               # WafermapPanel, WaferMap, WaferMapContextMenu
└── pages/YieldBinParetoPage.tsx
```
