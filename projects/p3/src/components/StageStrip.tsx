// 阶段一览色条:每个启用阶段一格,颜色 = 状态,悬停看计划/实际时间。
import { Tooltip } from 'antd';
import { STAGE_LABELS, STAGE_ORDER, STAGE_STATUS_LABELS } from '../constants/stages';
import type { Order } from '../types';

const COLORS = { pending: '#e2e2e2', inProgress: '#1677ff', done: '#52c41a', issue: '#ff4d4f' } as const;

export default function StageStrip({ order }: { order: Order }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {STAGE_ORDER.filter((k) => order.stages[k].enabled).map((k) => {
        const s = order.stages[k];
        return (
          <Tooltip
            key={k}
            title={
              <div>
                <div>
                  {STAGE_LABELS[k]} · {STAGE_STATUS_LABELS[s.status]}
                </div>
                <div>
                  计划 {s.planStart ?? '-'} ~ {s.planEnd ?? '-'}
                </div>
                {s.actualStart && (
                  <div>
                    实际 {s.actualStart} ~ {s.actualEnd ?? '进行中'}
                  </div>
                )}
              </div>
            }
          >
            <div style={{ width: 14, height: 14, borderRadius: 2, background: COLORS[s.status] }} />
          </Tooltip>
        );
      })}
    </div>
  );
}
