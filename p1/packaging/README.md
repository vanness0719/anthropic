# 打包成免安装可执行程序

把 p1(前端 + 后端)打成**单个可执行文件**。别人拿到后**无需安装 Python / Node / 依赖**,
双击即启动本地服务并自动打开浏览器,关闭窗口即退出。

## 原理

- 前端 `npm run build` 生成静态文件,由后端 FastAPI **同源托管**(不再需要单独的 Node 进程);
- `backend/launcher.py` 选一个空闲端口、启动服务、自动打开浏览器;
- PyInstaller 把 Python 解释器、所有依赖(含 PyMuPDF)、前端静态产物打进一个可执行文件。

## 本机打包

> ⚠️ 可执行文件**依平台而定**:在 Windows 上打出的是 `.exe`,在 macOS/Linux 上是对应原生可执行文件。
> 要给 Windows 用户,就在 Windows 上打包(或用下面的 GitHub Actions)。需要本机已装 Python 3.11+ 和 Node 18+。

### Windows

```powershell
cd p1\packaging
./build.ps1
# 产物: p1\packaging\dist\doclingo-p1.exe   ← 双击即可运行
```

### macOS / Linux

```bash
cd p1/packaging
./build.sh
# 产物: p1/packaging/dist/doclingo-p1       ← 双击或 ./dist/doclingo-p1
```

## 一次性构建三平台(GitHub Actions)

仓库根 `.github/workflows/p1-package.yml` 提供了手动触发的跨平台打包:
在 GitHub 仓库页 **Actions → Package p1 desktop app → Run workflow**,
运行完在该次运行的 **Artifacts** 里下载 Windows / macOS / Linux 三份可执行程序。

## 使用说明(交给最终用户)

1. 双击 `doclingo-p1`(Windows 为 `doclingo-p1.exe`);
2. 浏览器自动打开界面,上传 PDF、选语言与引擎;
3. **翻译需要一个模型凭证**:
   - 用 **Claude / OpenAI 兼容接口**:在界面里填自己的 API Key;
   - 或用**本地 Ollama**:先装好并 `ollama serve`,界面引擎选 Ollama,数据不出本机。
4. 关闭弹出的黑色控制台窗口即退出程序。

> 可执行文件里**不含任何 API Key**;每个使用者填自己的即可。

## 常见问题

- **杀毒软件误报**:PyInstaller 单文件程序常被误报,加信任或用系统自带的 Windows Defender 白名单即可;企业内分发建议做代码签名。
- **首次启动较慢**:单文件程序第一次运行会把自身解压到临时目录,属正常现象。
- **端口被占用**:启动器会自动换用空闲端口,无需手动配置。
