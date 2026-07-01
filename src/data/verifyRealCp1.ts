// 验证脚本:用工具自身的聚合函数处理真实 STDF 数据,并与 STDF 文件内
// 记录的 WRR 汇总(part=9747, good=9673, yield=99.24%)对照。
// 运行:  npx tsx src/data/verifyRealCp1.ts
import { realCp1 } from './realCp1';
import {
  aggregateBinPareto,
  avgYield,
  edgeYield,
  nonEdgeYield,
  passBinSet,
  stackWafermap,
  topFailBin,
} from '../utils/yieldCalc';

const p = realCp1;
const wafers = p.wafers;
const passBins = passBinSet(p.hbins);

let failures = 0;
function check(name: string, got: unknown, want: unknown, tol = 0) {
  const ok =
    typeof got === 'number' && typeof want === 'number'
      ? Math.abs(got - want) <= tol
      : got === want;
  if (!ok) failures++;
  console.log(`${ok ? '✅' : '❌'} ${name}: got=${got}  want=${want}${tol ? ` (±${tol})` : ''}`);
}

// --- 基本计数 ---
const totalDies = wafers[0].dies.length;
const passDies = wafers[0].dies.filter((d) => passBins.has(d.bin)).length;
console.log('=== 真实 STDF 数据集验证 ===');
console.log(`产品=${p.productId}  wafer=${wafers[0].waferId}  日期=${wafers[0].date}  gridSize=${p.gridSize}`);
check('total dies', totalDies, 9747);
check('pass dies (HBIN 11)', passDies, 9673);
check('wafer.yield', wafers[0].yield, 99.24, 0.01);
check('avgYield()', avgYield(wafers), 99.24, 0.01);

// --- HBin 帕累托 ---
const pareto = aggregateBinPareto(p, wafers, 'HBin');
const paretoTotal = pareto.reduce((s, r) => s + r.count, 0);
check('pareto sum == total dies', paretoTotal, 9747);
check('pareto cumPct 收敛到 100', pareto[pareto.length - 1].cumPct, 100, 0.05);
const passRow = pareto.find((r) => r.type === 'pass');
check('pass bin pct ~99.24', passRow?.pct ?? -1, 99.24, 0.02);
const top = topFailBin(pareto);
check('Top Fail Bin = flash_fun_fail', top?.name, 'flash_fun_fail');
check('Top Fail Bin count = 27', top?.count, 27);

console.log('\nHBin 帕累托明细:');
for (const r of pareto) {
  console.log(
    `  HBIN ${String(r.bin).padStart(3)} ${r.type === 'pass' ? 'P' : 'F'} ${r.name.padEnd(20)} ` +
      `count=${String(r.count).padStart(5)}  ${r.pct.toFixed(3)}%  cum=${r.cumPct.toFixed(2)}%`,
  );
}

// --- Edge / Non-Edge 良率(此前 bin===0 硬编码会算成 0) ---
check('edgeYield()', edgeYield(wafers, passBins), 95.25, 0.01);
check('nonEdgeYield()', nonEdgeYield(wafers, passBins), 99.37, 0.01);

// --- Wafermap 叠加 ---
const stacked = stackWafermap(wafers, passBins);
check('stacked cell 数 == die 数(单片)', stacked.length, 9747);
const avgPass = stacked.reduce((s, c) => s + c.passRate, 0) / stacked.length;
check('stacked 平均 passRate ~99.24', +avgPass.toFixed(2), 99.24, 0.5);

console.log(`\n${failures === 0 ? '🎉 全部通过' : `⚠️ ${failures} 项不匹配`}`);
if (failures > 0) throw new Error(`${failures} 项验证不匹配`);
