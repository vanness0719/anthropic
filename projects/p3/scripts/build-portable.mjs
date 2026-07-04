// 把 vite 构建产物打包成单个自包含 HTML(免安装:双击浏览器打开即用)。
// 用法:npm run build:portable
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const assets = join(dist, 'assets');
const files = readdirSync(assets);
const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));

const js = readFileSync(join(assets, jsFile), 'utf8');
const css = cssFile ? readFileSync(join(assets, cssFile), 'utf8') : '';

// 关闭 </script> 干扰,防止内联脚本提前闭合
const safeJs = js.replace(/<\/script>/gi, '<\\/script>');

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>P3 · 销售-生产-交付协同跟踪</title>
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script type="module">${safeJs}</script>
</body>
</html>
`;

mkdirSync('portable', { recursive: true });
const out = 'portable/p3.html';
writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`✅ 便携版已生成: ${out}  (${kb} KB,双击用浏览器打开即可)`);
