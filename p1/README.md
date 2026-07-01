# p1 · PDF 文档翻译(保留排版)MVP

一个类 Doclingo 的文档翻译 MVP:**上传 PDF → 翻译 → 保留原排版 → 下载**。
翻译引擎可插拔:调试阶段用 **Claude API**,也支持任意 **OpenAI 兼容接口** 和 **本地 Ollama 开源模型**。

## 功能

- 上传 PDF,选择源/目标语言(含自动检测)
- 保留排版:逐页提取文本块,抹掉原文后按原位置回填译文,尽量还原版式、图片、表格位置
- 可选翻译引擎:
  - **Claude API**(Anthropic 官方 SDK,默认 `claude-opus-4-8`)
  - **OpenAI 兼容接口**(任何 `/v1/chat/completions` 服务)
  - **Ollama 本地开源模型**(如 `qwen2.5:7b`,数据不出本机)
- 后台任务 + 进度轮询,完成后下载译文 PDF

## 技术栈

- **前端**:Vite + React 18 + TypeScript + Ant Design 5(沿用仓库根目录现有技术栈)
- **后端**:Python + FastAPI + [PyMuPDF](https://pymupdf.readthedocs.io/)(排版保留的核心)+ Anthropic SDK

## 目录结构

```
p1/
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py              # FastAPI 接口
│       ├── config.py            # 环境变量配置
│       ├── pdf_translator.py    # PyMuPDF 保留排版翻译核心
│       └── translators/         # 可插拔翻译引擎
│           ├── base.py          # 批量翻译协议 + 逐段回退
│           ├── claude.py        # Claude(Anthropic SDK)
│           ├── openai_compat.py # OpenAI 兼容接口
│           └── ollama.py        # 本地 Ollama
└── frontend/                    # Vite + React + AntD 界面
    └── src/{main.tsx, App.tsx, api.ts}
```

## 快速开始

### 1. 后端

```bash
cd p1/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # 按需填写 API Key / 模型
uvicorn app.main:app --reload --port 8000
```

Claude 凭证:在 `.env` 里填 `ANTHROPIC_API_KEY`;若运行环境已通过 `ant auth login`
配置了 profile,可留空,SDK 会自动解析。

### 2. 本地开源模型(可选)

```bash
ollama pull qwen2.5:7b        # 下载开源模型(支持中英日韩等多语)
ollama serve                  # 默认监听 http://localhost:11434
```

前端「翻译引擎」选 **Ollama** 即可,全程数据不出本机。

### 3. 前端

```bash
cd p1/frontend
npm install
npm run dev                   # 打开 http://localhost:5174
```

开发时 `/api` 已通过 Vite 代理到后端 `:8000`,无需额外配置跨域。

## 工作流

```
上传 PDF ──▶ 选引擎/语言 ──▶ POST /api/jobs(后台翻译)
                               │
                               ├─ GET /api/jobs/{id}         轮询进度
                               └─ GET /api/jobs/{id}/download 下载译文
```

## 接口一览

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| GET  | `/api/providers` | 列出可用引擎与默认模型 |
| POST | `/api/jobs` | 上传 PDF + 参数,创建翻译任务 |
| GET  | `/api/jobs/{id}` | 查询状态与进度 |
| GET  | `/api/jobs/{id}/download` | 下载译文 PDF |

## 已知局限(MVP)

- 复杂多栏、竖排、公式或扫描件(无文本层)的还原可能有偏差;扫描件需先做 OCR(后续可加)。
- CJK 目标语言使用 PyMuPDF 内置 CJK 字体(`china-s`/`japan`/`korea` 等)。
- 任务状态存内存,重启即失;生产环境可换 Redis/DB,并加持久化存储与鉴权。

## 模型说明

默认 Claude 模型为 `claude-opus-4-8`。若追求更低成本/更快速度,可在 `.env` 的
`CLAUDE_MODEL` 或前端「模型」输入框改为 `claude-haiku-4-5` / `claude-sonnet-5`。
