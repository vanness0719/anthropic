# A 股行情 App(p2)

iPhone 可用(H5/PWA)的 A 股行情分析工具:自选股列表、K 线图(MACD/KDJ)、**大单资金流入流出分析**、**市场情绪评分**、简单策略回测。**不做实盘下单。**

## 架构

```
iPhone Safari (H5 / PWA 添加到主屏幕)
   │
React 18 + klinecharts 9 + antd-mobile (Vite)
   │ /api/*
FastAPI + akshare(内存 TTL 缓存 + pandas 指标/回测引擎)
```

- **数据源**:akshare(东方财富/乐咕等免费源)。`P2_DATA_SOURCE` 环境变量控制:
  - `auto`(默认)— 优先 akshare,失败自动降级内置确定性 mock 数据,响应 `source` 字段标注实际来源,前端显示「模拟数据」角标;
  - `akshare` — 只用真实源,失败返回 502;
  - `mock` — 纯离线演示。
- **大单资金流**:东财口径,主力 = 超大单 + 大单;当日五档净流入 + 近 100 日历史;
  K 线页可开「主力资金」副图,与时间轴联动。
- **情绪分**:资金面(近5日主力净流入占比)/ 热度面(股吧人气排名+关注指数)/
  机构面(千股千评机构参与度)/ 大盘面(涨跌家数+涨停跌停),加权合成 0-100。
- **回测**:单标的日线全仓,双均线金叉 / MACD 金叉死叉 / KDJ 超买超卖;
  信号收盘确认、**次日开盘成交**(无未来函数);输出总收益/年化/最大回撤/胜率/净值曲线(对比买入持有)/逐笔交易。
- **指标口径**:MACD(12,26,9) 柱 = 2×(DIF−DEA);KDJ(9,3,3) 用国内 SMA(X,m,1) 递推。图表显示用 klinecharts 内置指标,回测用后端 pandas 实现,二者互为校验。

## 最快上手

前端构建产物已入库,不需要 Node/Docker。三种由简到全:

**① 双击启动(需装过 Python 3.11+)**
Windows 双击 `start.bat`,macOS 双击 `启动App.command`(首次右键 → 打开)。
首次运行自动装依赖;启动后**自动打开浏览器**,终端同时打印局域网地址和**二维码**,
iPhone(同一 Wi-Fi)扫码打开 → Safari「分享 → 添加到主屏幕」即可当 App 用。

**② 打包成免 Python 的可执行文件**
Windows 双击 `package.bat`(macOS 跑 `./package.sh`)打包一次,
产物在 `dist_app/A股行情(.exe)`(约 70MB)——以后双击这个文件即开,
换台没有 Python 的电脑也能用。注意 exe 不能跨系统,在哪个系统用就在哪个系统打包。

**③ 命令行**:`./start.sh` 或 `python serve.py`。

## 本地开发

```bash
# 后端(Python 3.11+)
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000

# 前端
cd frontend
npm install
npm run dev   # http://localhost:5173,/api 自动代理到 8000
```

手机调试:`npm run dev` 已开 `--host`,iPhone 与电脑同一局域网访问 `http://<电脑IP>:5173`。

## Docker 部署

```bash
docker compose up --build -d
# iPhone Safari 访问 http://<主机IP>:8080,分享 → 添加到主屏幕 即为全屏 App
```

## 验证

```bash
# 1. akshare 接口连通性与列名冒烟(升级 akshare 后必跑)
cd backend && .venv/bin/python scripts/smoke_akshare.py

# 2. 后端单测:指标手算样例、回测正确性(无未来函数/回撤/费率)、API 契约与守恒关系
.venv/bin/python -m pytest -q     # 22 passed

# 3. 前端类型检查与构建
cd frontend && npm run build

# 4. 接口抽查
curl "localhost:8000/api/kline/600519?period=daily&limit=100"
curl "localhost:8000/api/fundflow/600519"        # 主力 = 超大单+大单;四类净额之和 ≈ 0
curl "localhost:8000/api/sentiment/600519"       # 各维度 0~100
```

## 目录

```
backend/app/routers    quotes / kline / fundflow / sentiment / backtest
backend/app/services   akshare_client(真实源,列名映射收口)/ mock_client(同构模拟)
                       provider(auto 降级)/ indicators / sentiment / backtest
backend/tests          指标、回测、API 单测
frontend/src/pages     自选股 / 个股详情(K线+资金流+情绪)/ 回测
frontend/src/components/kline  klinecharts 封装 + 主力资金自定义副图指标
```

## 边界

- 不做实盘/模拟下单,无账户体系。
- 行情为免费源轮询(约 30s),非逐笔推送;「大单」为东财单型口径,非 Level-2 逐笔重建。
- 回测默认无滑点、费率 0.03%(可调);仅供学习研究,不构成投资建议。
