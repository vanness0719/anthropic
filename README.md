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
- **真实 STDF 数据集**(`src/data/realCp1.ts`)— 由实际芯片测试 STDF 文件离线解析生成,顶栏可切换

## 功能

- 顶部 KPI 栏:Avg.Yield(含环比)、#Lot/Wafers/Scrap、Top Fail Bin、Wafer Edge / Non-Edge Yield
- Yield Trend 趋势图(Line Chart),Smart Split(Day/Week/Month)切换 X 轴聚合粒度
- **趋势图框选 wafer → 与 Baseline 对比**(保留最近 2 片,联动到 Selected 晶圆图)
- Bin Pareto 表(HBin/SBin/SBinGroup),按 Bin% 降序;点击行 → 高亮晶圆图对应 bin
- Bin Pareto 条形图 + CDF Plot
- Stacked wafermap(Baseline vs Selected),按 Yield 或 Bin 上色
- 右键晶圆图弹出上下文菜单(Overlay/Export/Maximize 等;Overlay 类为占位)

### 真实 STDF 数据验证

已用一份**实际芯片测试 STDF 文件**(产品 `CCFC2011BC` / Lot `PC8C32.00` / Wafer `PC8C32-01B7`,
2025-04-07 CP1,9747 颗 die)验证本工具:

- 顶栏 **Mock / 真实STDF** 开关切换到真实数据集(`src/data/realCp1.ts`)。
- 运行验证脚本,用工具**自身的聚合函数**核对结果与 STDF 内 WRR 汇总是否一致:

  ```bash
  npx tsx src/data/verifyRealCp1.ts
  ```

  全部 15 项通过:总数 9747、pass 9673、**yield 99.24%**、Top Fail Bin `flash_fun_fail`(27)、
  Edge 95.25% / Non-Edge 99.37%、帕累托累计收敛到 100%。

> 验证中发现并修复:此前"pass"被硬编码为 `bin === 0`,而真实 STDF 的 pass 是 **HBIN 11**;
> 现改为从 bin 定义(`type === 'pass'`)推导,`src/utils/yieldCalc.ts` 的良率/Edge/wafermap 计算不再依赖特定 bin 号。

### 待实现(占位)

Box Plot / Bin Trend 选项卡内容、Overlay 真实数据叠加、浏览器内直接上传 STDF、真实后端接入、其余 CP 子模块。

## 运行

### 方式 A:Docker(推荐,无需本机装 Node)

```bash
docker compose up --build
```

构建完成后浏览器打开 **http://localhost:5173/** 即可。停止:`Ctrl + C`,或 `docker compose down`。

> 原理:多阶段构建 —— 先用 `node:22-alpine` 执行 `npm ci && npm run build`,再用 `nginx:alpine`
> 提供 `dist/` 静态文件;容器内 80 端口映射到宿主机 5173。

### 方式 C:便携版单文件(免安装,双击即用)⭐

无需 Node / Docker / 联网。仓库内已提供打包好的单文件:

**`portable/de-yms-yield-bin-pareto.html`** —— 下载后**双击用浏览器打开**即可,
默认直接展示真实 STDF 数据(wafer `PC8C32-01B7`,yield 99.24%),顶栏可切回 Mock。

重新生成(改动源码后):

```bash
npm run build:portable   # 产物见 portable/de-yms-yield-bin-pareto.html
```

> 原理:`scripts/build-portable.mjs` 把 vite 构建出的 JS/CSS 全部内联进一个 HTML,
> 不引用任何外部文件,因此 `file://` 双击打开就能运行。

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
